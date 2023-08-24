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


class ManagerFeedbackCoutPage(INGIniousAuthPage):
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
        if submission['result'] == 'crash':
            self.logger.error("No success submission found.")
            raise APIInvalidArguments()
        if not submission.get("text"):
            self.logger.error("No available feedback.")
            raise APIInvalidArguments()
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
        submission_feedback = json.loads(submission.get("text"))

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
        submission = self.submission_manager._database.submissions.find_one_and_update(
            {"_id": submission["_id"]},
            {"$set": {"text": json_data}},
            return_document=ReturnDocument.AFTER
        )
        return json.loads(submission['text'])


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
            return str(last_submission['_id'])
    return ''



class PreviewPage(INGIniousAdminPage):
    def POST_AUTH(self, courseid, taskid, submission_id):
        course, task = self.get_course_and_check_rights(courseid, taskid)
        get_submission_by_id(self.submission_manager, course, submission_id, self.logger)
        feedback_json = flask.request.json
        file_path = inginious.get_root_path() + '/frontend/plugins/manager_feedback/student_feedback_template.html'
        with codecs.open(file_path, 'r', encoding='utf8') as f:
            feedback_html = f.read()
        injected = inject_html(feedback_html, taskid, feedback_json)
        return injected


def get_submission_by_id(submission_manager, course, submission_id, logger):
    submission = submission_manager.get_submission(submissionid=submission_id, course=course)
    if submission['result'] == 'crash':
        logger.error("No success submission found.")
        raise APIInvalidArguments()
    if not submission.get("text"):
        logger.error("No available feedback.")
        raise APIInvalidArguments()
    return submission


def inject_html(html, task_id, json_data):
    feedback_html_injected_with_id = html.replace('task_id_to_replace', task_id)
    feedback_html_injected_with_id = feedback_html_injected_with_id.replace('feedback_json', u'eval(' + json.dumps(json_data) + u')')
    feedback_html_injected_with_id = '.. raw:: html' + '\n' + indent(feedback_html_injected_with_id, 4)
    return feedback_html_injected_with_id


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
    # plugin_manager.add_hook('feedback_menu', add_feedback_menu)
    plugin_manager.add_hook('css', add_css_file)
    plugin_manager.add_hook('css', add_qtip_css_file)
    plugin_manager.add_hook('javascript_header', add_js_file)
    plugin_manager.add_hook('javascript_header', add_qtip_js_file)
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>",
                            ManagerFeedbackPage.as_view('manager_feedback'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/cout",
                            ManagerFeedbackCoutPage.as_view('manager_feedback_cout'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/preview",
                            PreviewPage.as_view('preview'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/prev",
                            ManagerFeedbackPrevPage.as_view('manager_feedback_prev'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/next",
                            ManagerFeedbackNextPage.as_view('manager_feedback_next'))
