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
from docker.errors import NotFound
from pymongo import ReturnDocument

from inginious.frontend.pages.course_admin.utils import INGIniousAdminPage


class ManagerFeedbackCoutPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid, taskid, submission_id):
        self.get_course_and_check_rights(courseid, taskid)
        cout_param = flask.request.args.to_dict()['cout']
        submission = self.submission_manager.get_submission(submission_id, user_check=False)
        if submission['result'] == 'crash':
            raise NotFound(description=_("No success submission found."))
        if not submission.get("text"):
            raise NotFound(description=_("No feedback."))
        user_input = self.submission_manager.get_input_from_submission(submission, only_input=True)
        zip_bytes = user_input['gitlab']['value']
        filebytes = BytesIO(zip_bytes)
        zip_file = zipfile.ZipFile(filebytes)
        try:
            cout_path = [name for name in zip_file.namelist() if cout_param in name][0]
        except:
            self.logger.error(f'Failed to find cout file {cout_param} in submission id {submission_id}')
            raise NotFound(description=_("No cout found."))
        self.logger.debug(f'Required cout file: {cout_path}')
        cout_text = zip_file.open(cout_path).read()
        return cout_text


class ManagerFeedbackPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid, taskid, submission_id):

        manager_userdata = self.database.users.find_one({"email": self.user_manager.session_email()})

        if not manager_userdata:
            raise NotFound(description=_("User unavailable."))

        course, task = self.get_course_and_check_rights(courseid, taskid)
        users = self.user_manager.get_course_registered_users(course)
        submission = self.get_submission(course, submission_id)
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
                                           students=users,
                                           submission_id=submission['_id'],
                                           now=datetime.now())

    def get_submission(self, course, submission_id):
        submission = self.submission_manager.get_submission(submission_id, course)
        if submission['result'] == 'crash':
            raise NotFound(description=_("No success submission found."))
        if not submission.get("text"):
            raise NotFound(description=_("No feedback."))
        return submission

    def POST_AUTH(self, courseid, taskid, submission_id):
        course, task = self.get_course_and_check_rights(courseid, taskid)
        submission = self.get_submission(course, submission_id)
        updated_feedback = json.dumps(flask.request.json)
        submission = self.submission_manager._database.submissions.find_one_and_update(
            {"_id": submission["_id"]},
            {"$set": {"text": updated_feedback}},
            return_document=ReturnDocument.AFTER
        )
        return json.loads(submission['text'])

    def add_test_to_category(self, category, feedback, value):
        feedback[category]["tests"].append(value)
        feedback[category]["status"]["total"] += 1
        if value["result"]["bool"]:
            feedback[category]["status"]["passed"] += 1

    def get_username(self, email):
        """
           :param email:
            :return: the username of the user if it can be found, None else
            User-manager has no code to get username by email
           """
        user = self.user_manager._database.users.find_one({"email": email})
        return user["username"] if user else None

    def injectHtml(self, html, task_id, doneJson):
        feedback_html_injected_with_id = html.replace('task_id_to_replace', task_id)
        feedback_html_injected_with_id = '.. raw:: html' + '\n' + self.indent(feedback_html_injected_with_id, 4)
        scenario_output_html = feedback_html_injected_with_id.format(
            feedback_json=u'eval(' + json.dumps(doneJson) + u')'
        )
        return scenario_output_html

    def indent(self, text, amount, ch=' '):
        padding = amount * ch
        return ''.join(padding + line for line in text.splitlines(True))


def add_css_file():
    """ Add manage_feedback css file to the admin page """
    return ('/static/plugins/manager_feedback/feedback.css')


def add_js_file():
    """ Add manage_feedback js file to the admin page """
    return '/static/plugins/manager_feedback/feedback.js'


def add_qTip_css_file():
    """ Add manage_feedback css file to the admin page """
    return 'https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.css'


def add_qTip_js_file():
    """ Add manage_feedback js file to the admin page """
    return 'https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.js'


class PreviewPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid, taskid, submission_id):
        print("we are here")
        injected = ""
        feedback = json.loads(list(flask.request.values.dicts[0].to_dict().keys())[0])
        feedback_json = feedback
        with codecs.open(
                '/home/darias/Documents/pycharm/INGInious/inginious/frontend/plugins/manager_feedback/student_feedback_template.html',
                'r',
                encoding='utf8') as f:
            feedback_html = f.read()
        injected = self.injectHtml(feedback_html, taskid, feedback_json)

        return injected

    def injectHtml(self, html, task_id, doneJson):
        feedback_html_injected_with_id = html.replace('task_id_to_replace', task_id)
        feedback_html_injected_with_id = '.. raw:: html' + '\n' + self.indent(feedback_html_injected_with_id, 4)
        scenario_output_html = feedback_html_injected_with_id.format(
            feedback_json=u'eval(' + json.dumps(doneJson) + u')'
        )
        return scenario_output_html

    def indent(self, text, amount, ch=' '):
        padding = amount * ch
        return ''.join(padding + line for line in text.splitlines(True))


def init(plugin_manager, _, _2, _3):
    """ Init the cpp feedback plugin """
    # plugin_manager.add_hook('feedback_menu', add_feedback_menu)
    plugin_manager.add_hook('css', add_css_file)
    plugin_manager.add_hook('css', add_qTip_css_file)
    plugin_manager.add_hook('javascript_header', add_js_file)
    plugin_manager.add_hook('javascript_header', add_qTip_js_file)
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>",
                            ManagerFeedbackPage.as_view('manager_feedback'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/cout",
                            ManagerFeedbackCoutPage.as_view('manager_feedback_cout'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<submission_id>/preview", PreviewPage.as_view('preview'))
