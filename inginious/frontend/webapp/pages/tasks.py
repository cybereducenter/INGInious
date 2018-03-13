# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Task page """
import base64
import json
import mimetypes
import os
import posixpath
import urllib.request, urllib.parse, urllib.error
import traceback
import codecs
import locale
import web

from bson.objectid import ObjectId
from inginious.common import exceptions
from inginious.frontend.common.task_page_helpers import submission_to_json, list_multiple_multiple_choices_and_files, indent
from inginious.frontend.webapp.pages.utils import INGIniousAuthPage



class TaskPage(INGIniousAuthPage):
    """ Display a task (and allow to reload old submission/file uploaded during a submission) """

    def set_selected_submission(self, course, task, submissionid):
        submission = self.submission_manager.get_submission(submissionid)
        is_staff = self.user_manager.has_staff_rights_on_course(course, self.user_manager.session_username())

        # Do not enable submission selection after deadline
        if not task.get_accessible_time().is_open() and not is_staff:
            return False

        # Check if task is done per group/team
        if task.is_group_task() and not is_staff:
            group = self.database.aggregations.find_one(
                {"courseid": task.get_course_id(), "groups.students": self.user_manager.session_username()},
                {"groups": {"$elemMatch": {"students": self.user_manager.session_username()}}})
            students = group["groups"][0]["students"]
        else:
            students = [self.user_manager.session_username()]

        # Check if group/team is the same
        if students == submission["username"]:
            self.database.user_tasks.update_many(
                {"courseid": task.get_course_id(), "taskid": task.get_id(), "username": {"$in": students}},
                {"$set": {"submissionid": submission['_id'],
                          "grade": submission['grade'],
                          "succeeded": submission["result"] == "success"}})
            return True
        else:
            return False

    def GET_AUTH(self, courseid, taskid):  # pylint: disable=arguments-differ
        """ GET request """
        username = self.user_manager.session_username()

        # Fetch the course
        try:
            course = self.course_factory.get_course(courseid)
        except exceptions.CourseNotFoundException as ex:
            raise web.notfound(str(ex))

        if not self.user_manager.course_is_open_to_user(course, username):
            return self.template_helper.get_renderer().course_unavailable()

        # Fetch the task
        try:
            task = course.get_task(taskid)
        except exceptions.TaskNotFoundException as ex:
            raise web.notfound(str(ex))

        if not self.user_manager.task_is_visible_by_user(task, username):
            return self.template_helper.get_renderer().task_unavailable()

        self.user_manager.user_saw_task(username, courseid, taskid)

        userinput = web.input()
        if "submissionid" in userinput and "questionid" in userinput:
            # Download a previously submitted file
            submission = self.submission_manager.get_submission(userinput["submissionid"], user_check=True, course=course)
            if submission is None:
                raise web.notfound()
            sinput = self.submission_manager.get_input_from_submission(submission, True)
            if userinput["questionid"] not in sinput:
                raise web.notfound()


            if isinstance(sinput[userinput["questionid"]], dict):
                # File uploaded previously
                mimetypes.init()
                mime_type = mimetypes.guess_type(urllib.request.pathname2url(sinput[userinput["questionid"]]['filename']))
                web.header('Content-Type', mime_type[0])
                return base64.b64decode(sinput[userinput["questionid"]]['value'])
            else:
                # Other file, download it as text
                web.header('Content-Type', 'text/plain')
                return sinput[userinput["questionid"]]
        else:
            # user_task always exists as we called user_saw_task before
            user_task = self.database.user_tasks.find_one({
                "courseid": task.get_course_id(),
                "taskid": task.get_id(),
                "username": self.user_manager.session_username()
            })

            submissionid = user_task.get('submissionid', None)
            eval_submission = self.database.submissions.find_one({'_id': ObjectId(submissionid)}) if submissionid else None

            students = [self.user_manager.session_username()]
            if task.is_group_task() and not self.user_manager.has_admin_rights_on_course(course, username):
                group = self.database.aggregations.find_one(
                    {"courseid": task.get_course_id(), "groups.students": self.user_manager.session_username()},
                    {"groups": {"$elemMatch": {"students": self.user_manager.session_username()}}})
                if group is not None and len(group["groups"]) > 0:
                    students = group["groups"][0]["students"]
                # we don't care for the other case, as the student won't be able to submit.

            submissions = self.submission_manager.get_user_submissions(task)
            submissions = [self.submission_manager.get_feedback_from_submission(submission, inginious_page_object=self) for submission in submissions]

            # Display the task itself
            return self.template_helper.get_renderer().task(course, task,
                                                            submissions,
                                                            students, eval_submission, user_task, self.webterm_link)

    def POST_AUTH(self, courseid, taskid):  # pylint: disable=arguments-differ
        """ POST a new submission """
        username = self.user_manager.session_username()
        try:
            course = self.course_factory.get_course(courseid)
            if not self.user_manager.course_is_open_to_user(course, username):
                return self.template_helper.get_renderer().course_unavailable()

            task = course.get_task(taskid)
            if not self.user_manager.task_is_visible_by_user(task, username):
                return self.template_helper.get_renderer().task_unavailable()

            self.user_manager.user_saw_task(username, courseid, taskid)

            is_staff = self.user_manager.has_staff_rights_on_course(course, username)
            is_admin = self.user_manager.has_admin_rights_on_course(course, username)
            task_type = task._type

            # TODO: this is nearly the same as the code in the webapp.
            # We should refactor this.

            userinput = web.input()
            if "@action" in userinput and userinput["@action"] == "submit":
                # Verify rights
                if not self.user_manager.task_can_user_submit(task, username):
                    return json.dumps({"status": "error", "text": "You are not allowed to submit for this task."})

                # Reparse user input with array for multiple choices
                init_var = list_multiple_multiple_choices_and_files(task)
                userinput = task.adapt_input_for_backend(web.input(**init_var))

                if not task.input_is_consistent(userinput, self.default_allowed_file_extensions, self.default_max_file_size):
                    web.header('Content-Type', 'application/json')
                    return json.dumps({"status": "error", "text": "Please answer to all the questions and verify the extensions of the files "
                                                                  "you want to upload. Your responses were not tested."})
                del userinput['@action']

                # Get debug info if the current user is an admin
                debug = is_admin
                if "@debug-mode" in userinput:
                    if userinput["@debug-mode"] == "ssh" and debug:
                        debug = "ssh"
                    del userinput['@debug-mode']

                if len(task._problems) > 0 and task._problems[0].get_type() == 'code':
                    userinput = self.add_feedback_html_to_user_input(userinput, taskid, task_type)


                # Start the submission
                try:
                    self.logger.info('before submitting to docker')
                    submissionid, oldsubids = self.submission_manager.add_job(task, userinput, debug)
                    web.header('Content-Type', 'application/json')
                    return json.dumps({"status": "ok", "submissionid": str(submissionid), "remove": oldsubids})
                except Exception as ex:
                    web.header('Content-Type', 'application/json')
                    return json.dumps({"status": "error", "text": str(ex)})

            elif "@action" in userinput and userinput["@action"] == "check" and "submissionid" in userinput:
                result = self.submission_manager.get_submission(userinput['submissionid'])
                if result is None:
                    self.logger.error('error in getting results for ' + repr(username) + ' submissionid ' +repr(userinput['submissionid']))
                    web.header('Content-Type', 'application/json')
                    return json.dumps({'status': "error"})
                elif self.submission_manager.is_done(result):
                    self.logger.info('student got results ' + repr(username) + ' submissionid ' +repr(userinput['submissionid']))
                    web.header('Content-Type', 'application/json')
                    result = self.submission_manager.get_input_from_submission(result)
                    result = self.submission_manager.get_feedback_from_submission(result, show_everything=is_staff, inginious_page_object=self)

                    # per ana's design, this alert box should always be gray no matter what the grade is.
                    result['grade_css_class'] = ' grade gray feedback-box'
                    # user_task always exists as we called user_saw_task before
                    user_task = self.database.user_tasks.find_one({
                        "courseid":task.get_course_id(),
                        "taskid": task.get_id(),
                        "username": self.user_manager.session_username()
                    })
                    submissionid = user_task.get('submissionid', None)
                    default_submission = self.database.submissions.find_one({'_id': ObjectId(submissionid)}) if submissionid else None
                    if default_submission is None:
                        self.set_selected_submission(course, task, userinput['submissionid'])

                    return submission_to_json(result, is_admin, False, True if default_submission is None else default_submission['_id'] == result['_id'])

                else:
                    self.logger.info('student is waiting for results ' + repr(username) + ' submissionid ' +repr(userinput['submissionid']))
                    web.header('Content-Type', 'application/json')
                    if "ssh_host" in result:
                        return json.dumps({'status': "waiting",
                                           'ssh_host': result["ssh_host"],
                                           'ssh_port': result["ssh_port"],
                                           'ssh_password': result["ssh_password"]})
                    # Here we are waiting. Let's send some useful information.
                    waiting_data = self.submission_manager.get_job_queue_info(result["jobid"]) if "jobid" in result else None
                    if waiting_data is not None:
                        nb_tasks_before, approx_wait_time = waiting_data
                        return json.dumps({'status': "waiting", 'nb_tasks_before': nb_tasks_before, 'approx_wait_time': approx_wait_time})
                    return json.dumps({'status': "waiting"})
            elif "@action" in userinput and userinput["@action"] == "load_submission_input" and "submissionid" in userinput:
                submission = self.submission_manager.get_submission(userinput["submissionid"])
                submission = self.submission_manager.get_input_from_submission(submission)
                submission = self.submission_manager.get_feedback_from_submission(submission, show_everything=is_staff, inginious_page_object=self)
                if not submission:
                    raise web.notfound()
                web.header('Content-Type', 'application/json')
                return submission_to_json(submission, is_admin, True)
            elif "@action" in userinput and userinput["@action"] == "kill" and "submissionid" in userinput:
                self.submission_manager.kill_running_submission(userinput["submissionid"])  # ignore return value
                web.header('Content-Type', 'application/json')
                return json.dumps({'status': 'done'})
            elif "@action" in userinput and userinput["@action"] == "set_submission" and "submissionid" in userinput:
                web.header('Content-Type', 'application/json')
                if task.get_evaluate() != 'student':
                    return json.dumps({'status': "error"})

                if self.set_selected_submission(course, task, userinput["submissionid"]):
                    return json.dumps({'status': 'done'})
                else:
                    return json.dumps({'status': 'error'})
            else:
                raise web.notfound()
        except:
            if web.config.debug:
                raise
            else:
                raise web.notfound()

    def add_feedback_html_to_user_input(self, user_input, task_id, task_type):
        self.logger.info('before opening feebdack.html')
        try:

            # couldn't open with  get_renderer, errors on js, tries to render the page and run the js
            feedback_file_name = self.get_feedback_file_name(task_type)
            file_path = self.template_helper._root_path + '/'+ self.template_helper._template_dir + '/task_page/' +feedback_file_name
            self.logger.info('file_path ' +repr(file_path))
            with codecs.open(file_path,'r',encoding='utf8') as f:
                feedback_html = f.read()
            # todo, in order to support multiple scenario boxes in the same html page,
            # it might be a good idea to render the html with the task id in it (05-06, for example)
            # that way, the way the js will render in the appropriate modal
            feedback_html_injected_with_id = feedback_html.replace('task_id_to_replace', task_id)
            feedback_html_injected_with_id = '.. raw:: html' + '\n' + indent(feedback_html_injected_with_id, 4)
            user_input['html_template'] = feedback_html_injected_with_id
        except Exception as err:
            prefered_encoding = locale.getpreferredencoding()
            self.logger.error( ' ---- prefered_encoding ' + repr(prefered_encoding))
            # text = 'error template_helper --- ' + repr(err)
            # self.logger.error(text)
            self.logger.error('traceback data is ' + traceback.format_exc())
            user_input['html_template'] = ''

        return user_input


    def get_feedback_file_name(self, task_type):
        if task_type == 'python-unit-test':
            return 'feedback_python.html'

        return 'feedback.html'



class TaskPageStaticDownload(INGIniousAuthPage):
    """ Allow to download files stored in the task folder """

    def GET_AUTH(self, courseid, taskid, path):  # pylint: disable=arguments-differ
        """ GET request """
        try:
            course = self.course_factory.get_course(courseid)
            if not self.user_manager.course_is_open_to_user(course):
                return self.template_helper.get_renderer().course_unavailable()

            task = course.get_task(taskid)
            if not self.user_manager.task_is_visible_by_user(task):
                return self.template_helper.get_renderer().task_unavailable()

            path_norm = posixpath.normpath(urllib.parse.unquote(path))
            public_folder_path = os.path.normpath(os.path.realpath(os.path.join(task.get_directory_path(), "public")))
            file_path = os.path.normpath(os.path.realpath(os.path.join(public_folder_path, path_norm)))

            # Verify that we are still inside the public directory
            if os.path.normpath(os.path.commonprefix([public_folder_path, file_path])) != public_folder_path:
                raise web.notfound()

            if os.path.isfile(file_path):
                mimetypes.init()
                mime_type = mimetypes.guess_type(file_path)
                web.header('Content-Type', mime_type[0])
                return open(file_path, 'rb')
            else:
                raise web.notfound()
        except:
            if web.config.debug:
                raise
            else:
                raise web.notfound()
