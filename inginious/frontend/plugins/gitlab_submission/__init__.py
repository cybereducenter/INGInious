import base64
import hashlib
import json
import logging
import os
import zipfile
from io import BytesIO

import flask
from flask_mail import Message

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from inginious.frontend import app
from inginious.frontend.pages.api._api_page import (
    APINotFound,
    APIInvalidArguments,
    APIError,
    APIForbidden
)
from inginious.frontend.pages.utils import INGIniousPage
from inginious.frontend.user_manager import UserManager

FILE_STORAGE_LOCATION = '/tmp'

logger = logging.getLogger('inginious.webapp.plugin.gilabsubmission')


class GitlabSubmissionPage(INGIniousPage):

    def __init__(self):
        self.gitlab_course_type = os.environ.get('GITLAB_COURSE_TYPE', 'cpp-test')
        self.public_key = os.environ.get('PUBLIC_KEY', """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1YX92NdNefTiurunFjSZ
RyCpD8KQYxlAHIRg1bCqM17ygixFX1Lww6kyaA1vmONosdvpHrknoqBzljR/bLuz
ooYdXGZf4JNINZfKQ4MHjGZUlCNZWjfTUOKGL4r4KkvZIj7fhnt9XUz00daqzc+X
pCp1WmZVf9Ss0aikgP9PBolTggXY2KVUwfqWxyv3ByDYj6lXWMyzHkyfoVbJwu92
JuCTEBoANiH+a8IXVqf836MzJ5kxT1Zy7upniFp8e8j2aN864mF2kYmvPc86JPkr
usgCgDsBmtTGxiWawTQHIor08vWzB2d/7XMdKLpMKJq1IUBv902MSVR5YPnB0Zug
rQIDAQAB
-----END PUBLIC KEY-----""").encode()

    def POST(self):
        """ POST request """
        """
            Creates a new submissions. Takes as (POST) input a zip file.
            Assuming one task for one student exists in the zip

            Returns

            - an error 400 Bad Request if all the input is not (correctly) given,
            - an error 403 Forbidden if you are not allowed to create a new submission for this task
            - an error 404 Not found if the course/task id not found
            - an error 500 Internal server error if the grader is not available,
            - 200 Ok, with {"submissionid": "the submission id"} as output.
        """
        orig = list(flask.request.files.values())[0]
        zip_file_org, zip_path = get_request_zip(orig)
        try:
            cloned_bytes = clone_bytes(orig)
            cloned_file = FileStorage(
                stream=cloned_bytes,
                filename=orig.filename,
                content_type=orig.content_type,
                headers=orig.headers,
            )
            self.verify_zip_sign(zip_path)
            runner_summary = get_runner_summary_data(orig)

            task_info = runner_summary['pipeline_info']
            course_id, task_id = runner_summary['courseid'], task_info['taskid']

            try:
                course = self.course_factory.get_course(course_id)
            except Exception:
                raise APINotFound("Course not found")

            email = runner_summary['email']
            self.logger.info(f'Gitlab submission for course {course_id}, task {task_id}, user email {email}')
            username = self.get_username(email)
            if not username:
                raise APINotFound(f"User with email {email} was not found")

            if not self.user_manager.course_is_open_to_user(course, username, False):
                raise APIForbidden("You are not registered to this course")

            try:
                task = course.get_task(task_id)
            except Exception:
                raise APINotFound("Task not found")

            user_input = {'@action': 'submit'}
            if task._type == self.gitlab_course_type:
                problem = task.get_problems()[0]
                user_input[problem.get_id()] = cloned_file
                self.logger.info(f'Add input {problem.get_id()} to submission')

            user_input = task.adapt_input_for_backend(user_input)

            if not task.input_is_consistent(user_input, self.default_allowed_file_extensions,
                                            self.default_max_file_size):
                raise APIInvalidArguments()

            self.user_manager.user_saw_task(username, course_id, task_id)

            # Verify rights
            if not self.user_manager.task_can_user_submit(task, username=username, only_check='groups'):
                raise APIForbidden("You are not allowed to submit for this task")

            # Get debug info if the current user is an admin
            debug = self.user_manager.has_admin_rights_on_course(course, username)
            logger.info(f'has_admin_rights_on_course: {debug}')

            real_name = self.user_manager.get_user_realname(username)
            language = self.user_manager.session_language()
            self.user_manager.connect_user(username, real_name, email, language, False)

            try:
                submission_id, _ = self.submission_manager.add_job(task, user_input, debug)
                return {"submissionid": str(submission_id)}
            except Exception as ex:
                raise APIError(500, str(ex))
        finally:
            os.remove(zip_path)

    def get_username(self, email):
        """
       :param email:
        :return: the username of the user if it can be found, None else
        User-manager has no code to get username by email
       """
        user = self.user_manager._database.users.find_one({"email": email})
        return user["username"] if user else None

    def verify_zip_sign(self, zip_path):
        public_key = serialization.load_pem_public_key(self.public_key)

        # Read the signature from the ZIP comment
        with zipfile.ZipFile(zip_path, 'r') as zip_file:
            signature_base64 = zip_file.comment.decode('utf-8')

        # Open the ZIP file and reset the comment
        with zipfile.ZipFile(zip_path, 'a') as zip_file:
            zip_file.comment = ''.encode('utf-8')

        # Decode the Base64 signature
        signature = base64.b64decode(signature_base64)

        # Calculate the hash of the ZIP content, excluding the comment
        with open(zip_path, 'rb') as zip_file:
            hash_value = hashlib.sha256(zip_file.read()).digest()

        # Open the ZIP file and add the signature to the comment
        with zipfile.ZipFile(zip_path, 'a') as zip_file:
            zip_file.comment = signature_base64.encode('utf-8')

        # Verify the signature using the public key
        try:
            public_key.verify(
                signature,
                hash_value,
                padding.PKCS1v15(),
                hashes.SHA256()
            )
            logger.debug("Signature is valid. The ZIP file is authentic.")
        except InvalidSignature:
            logger.error("Invalid signature. The ZIP file may have been tampered with.")
            raise APIInvalidArguments()


def clone_bytes(zip_file):
    file_like_object = zip_file.stream._file
    file_like_object.seek(0)
    cloned = BytesIO(file_like_object.read())
    file_like_object.seek(0)
    return cloned


def get_runner_summary_data(file):
    zipfile_ob = zipfile.ZipFile(file)
    file_name = [name for name in zipfile_ob.namelist() if name.endswith('RunnersSummary.json')][0]
    with zipfile_ob.open(file_name) as data_read:
        summary_content_str = data_read.read()
    return json.loads(summary_content_str)


def get_request_zip(request_zip):
    filename = secure_filename(request_zip.filename)
    zip_path = os.path.join(FILE_STORAGE_LOCATION, filename)
    request_zip.save(zip_path)
    return request_zip, zip_path


def send_email(submission, archive, newsub, user_manager):
    if submission["result"] == 'success' or submission["result"] == 'failed':
        logger.debug(f'Gitlab submission done with {submission["result"]} result')
        try:
            email = user_manager.get_user_email(submission['username'][0])
            name = user_manager.get_user_realname(submission['username'][0])
            subject = _("Submission succeeded")
            body = _(f"""Dear {name}, 
            your submission for course '{submission['courseid']}' / task '{submission['taskid']}' succeeded! 
            Good job!""")
            mail = app.mail
            email = UserManager.sanitize_email(email)
            message = Message(recipients=[(name, email)],
                              subject=subject,
                              body=body)
            mail.send(message)
            logger.debug(f'Gitlab submission done mail was sent to {submission["username"][0]}')
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            pass


def init(plugin_manager, _, _2, _3):
    plugin_manager.add_page("/gitlab/submission", GitlabSubmissionPage.as_view('gitlabsubmission'))
    plugin_manager.add_hook('submission_done', send_email)
