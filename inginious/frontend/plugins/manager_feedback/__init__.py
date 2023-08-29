# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" manage_feedback plugin - show course overview of student grades """
import codecs
import json
import zipfile
from datetime import datetime
from io import BytesIO

import flask
import pymongo
from pymongo import ReturnDocument

import inginious
from inginious.frontend.feedback_service import indent
from inginious.frontend.matrix_service import get_course_students
from inginious.frontend.pages.api._api_page import APIInvalidArguments
from inginious.frontend.pages.course_admin.utils import INGIniousAdminPage
from inginious.frontend.pages.utils import INGIniousAuthPage


class FeedbackCoutPage(INGIniousAuthPage):
    def GET_AUTH(self, courseid, taskid, submission_id):
        try:
            course = self.course_factory.get_course(courseid)
        except:
            self.logger.error("Course not found")
            raise APIInvalidArguments()
        submission = self.submission_manager.get_submission(submission_id, user_check=True, course=course)
        if submission['courseid'] != courseid or submission['taskid'] != taskid:
            self.logger.error("Invalid submission .")
            raise APIInvalidArguments()
        validate_submission(self.logger, submission)
        cout_param = flask.request.args.to_dict()['cout']
        user_input = self.submission_manager.get_input_from_submission(submission, only_input=True)
        zip_bytes = user_input['gitlab']['value']
        filebytes = BytesIO(zip_bytes)
        zip_file = zipfile.ZipFile(filebytes)
        try:
            cout_path = [name for name in zip_file.namelist() if cout_param in name][0]
        except:
            self.logger.error(f'Failed to find cout file {cout_param} in submission id {submission_id}')
            raise APIInvalidArguments()
        self.logger.debug(f'Required cout file: {cout_path}')
        cout_text = zip_file.open(cout_path).read()
        return cout_text


class ManagerFeedbackPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid, taskid, submission_id):

        manager_userdata = self.database.users.find_one({"email": self.user_manager.session_email()})

        if not manager_userdata:
            self.logger.error('Unavailable manager user')
            raise APIInvalidArguments()

        course, task = self.get_course_and_check_rights(courseid, taskid)
        submission = get_submission_by_id(self.submission_manager, course, submission_id, self.logger)
        student_userdata = self.database.users.find_one({"username": submission['username'][0]})
        submission_feedback = json.loads(submission['custom']['feedback_data'])

        return self.template_helper.render("manage_feedback.html",
                                           template_folder='frontend/plugins/manager_feedback',
                                           course=course,
                                           task=task,
                                           student=student_userdata['realname'],
                                           feedback=submission_feedback,
                                           user=manager_userdata,
                                           student_username=submission['username'][0],
                                           submission_id=submission['_id'],
                                           now=datetime.now())

    def POST_AUTH(self, courseid, taskid, submission_id):
        course, task = self.get_course_and_check_rights(courseid, taskid)
        submission = get_submission_by_id(self.submission_manager, course, submission_id, self.logger)
        updated_feedback = flask.request.json
        if not updated_feedback['categories']:
            self.logger.error("Invalid categories")
            raise APIInvalidArguments()
        json_data = json.dumps(updated_feedback)

        feedback_html = submission.get('text')
        if flask.request.args.to_dict().get('submit', 'false') == 'true':
            feedback_html = inject_html(courseid, taskid, submission_id, updated_feedback)
        submission = self.submission_manager._database.submissions.find_one_and_update(
            {"_id": submission["_id"]},
            {"$set": {"custom": {'feedback_data': json_data}, 'text': feedback_html}},
            return_document=ReturnDocument.AFTER
        )
        return json.loads(submission['custom']['feedback_data'])


class ManagerFeedbackPrevPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid, taskid, submission_id):
        return get_next_prev_student(self, courseid, taskid, submission_id, True)


class ManagerFeedbackNextPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid, taskid, submission_id):
        return get_next_prev_student(self, courseid, taskid, submission_id, False)


def get_next_prev_student(page, courseid, taskid, submission_id, is_prev):
    course, _ = page.get_course_and_check_rights(courseid, taskid)
    submission = get_submission_by_id(page.submission_manager, course, submission_id, page.logger)
    current_username = submission['username'][0]
    course_users = list(get_course_students(course, page.user_manager).keys())
    current_index = course_users.index(current_username)
    if is_prev:
        sub_list = course_users[:current_index]  # get users till current user
        sub_list = sub_list[::-1]  # run in reversed order
    else:
        sub_list = course_users[current_index + 1:]
    for user in sub_list:
        last_submission = page.database.submissions.find_one(
            {'username': user, 'courseid': courseid, 'taskid': taskid},
            sort=[('submitted_on', pymongo.DESCENDING)]
        )
        if last_submission:
            try:
                validate_submission(page.logger, last_submission)
            except:
                continue
            return str(last_submission['_id'])
    return ''


class PreviewPage(INGIniousAdminPage):
    def POST_AUTH(self, courseid, taskid, submission_id):
        course, task = self.get_course_and_check_rights(courseid, taskid)
        get_submission_by_id(self.submission_manager, course, submission_id, self.logger)
        feedback_json = flask.request.json
        injected = inject_html(courseid, taskid, submission_id, feedback_json)
        return injected


def get_submission_by_id(submission_manager, course, submission_id, logger):
    submission = submission_manager.get_submission(submissionid=submission_id, course=course)
    validate_submission(logger, submission)
    return submission


def validate_submission(logger, submission):
    if submission['result'] == 'crash':
        logger.error("No success submission found.")
        raise APIInvalidArguments()
    if not submission.get("text"):
        logger.error("No available feedback.")
        raise APIInvalidArguments()


def inject_html(courseid, task_id, submissionid, feedback_json):
    file_path = inginious.get_root_path() + '/frontend/plugins/manager_feedback/student_feedback_template.html'
    with codecs.open(file_path, 'r', encoding='utf8') as f:
        feedback_html = f.read()
    injected = feedback_html.replace('task_id', task_id)
    injected = injected.replace('course_id', courseid)
    injected = injected.replace('submission_id', submissionid)
    injected = injected.replace('feedback_json', u'eval(' + json.dumps(feedback_json) + u')')
    injected = '.. raw:: html' + '\n' + indent(injected, 4)
    return injected


def add_css_file():
    """ Add manage_feedback css file to the admin page """
    return '/static/plugins/manager_feedback/feedback.css'


def add_js_file():
    """ Add manage_feedback js file to the admin page """
    return '/static/plugins/manager_feedback/feedback.js'


def add_qtip_css_file():
    """ Add manage_feedback css file to the admin page """
    return 'https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.css'


def add_qtip_js_file():
    """ Add manage_feedback js file to the admin page """
    return 'https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.js'


def init(plugin_manager, _, _2, _3):
    """ Init the cpp feedback plugin """
    plugin_manager.add_hook('css', add_css_file)
    plugin_manager.add_hook('css', add_qtip_css_file)
    plugin_manager.add_hook('javascript_header', add_js_file)
    plugin_manager.add_hook('javascript_header', add_qtip_js_file)
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>",
                            ManagerFeedbackPage.as_view('manager_feedback'))
    plugin_manager.add_page("/feedback/<courseid>/<taskid>/<submission_id>/cout",
                            FeedbackCoutPage.as_view('feedback_cout'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/preview",
                            PreviewPage.as_view('preview'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/prev",
                            ManagerFeedbackPrevPage.as_view('manager_feedback_prev'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/next",
                            ManagerFeedbackNextPage.as_view('manager_feedback_next'))
