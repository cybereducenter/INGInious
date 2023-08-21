# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" manage_feedback plugin - show course overview of student grades """
import codecs
import json
import logging
import zipfile
from gridfs import GridFS
from collections import OrderedDict

import bson
import gridfs
from docker.errors import NotFound
from pymongo import MongoClient

from inginious.common.base import id_checker
from inginious.frontend.pages.course_admin.utils import INGIniousAdminPage, calculate_time_passed_since
from inginious.common.tasks_constants import TaskConstants
from datetime import datetime
import pymongo
import flask

from inginious.frontend.pages.utils import INGIniousPage

logger = logging.getLogger("frontend")
CATEGORY_1 = "config"
CATEGORY_2 = "progr"
CATEGORY_3 = "func"
CATEGORY_4 = "design"
CATEGORY_5 = "order"


class CoutPage(INGIniousPage):
    def POST(self, courseid, taskid, username, test):
        with zipfile.ZipFile(
                "/home/darias/Documents/pycharm/INGInious/inginious/frontend/plugins/manager_feedback/KfarShmaryahu_ColonelMustard_Ex3.zip",
                mode="r") as archive:
            with archive.open("RunnersSummary.json") as f:
                runner_summary = json.load(f)
            for file in archive.filelist:
                if file.filename.startswith("Cout/") and file.file_size > 0:
                    name = file.filename.split("/")[1].split(".")[0]
                    if test == name:
                        return archive.open(file.filename).read()
        return ""


class ManagerFeedbackPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid, taskid, username):

        manager_userdata = self.database.users.find_one({"email": self.user_manager.session_email()})
        student_userdata = self.database.users.find_one({"username": username})

        if not manager_userdata:
            raise NotFound(description=_("User unavailable."))

        course, task = self.get_course_and_check_rights(courseid, taskid)
        users = self.user_manager.get_course_registered_users(course)

        cout_files_dict = {}
        code_files_dict = {}
        with zipfile.ZipFile(
                "/home/darias/Documents/pycharm/INGInious/inginious/frontend/plugins/manager_feedback/KfarShmaryahu_ColonelMustard_Ex3.zip",
                mode="r") as archive:
            with archive.open("RunnersSummary.json") as f:
                runner_summary = json.load(f)
            for file in archive.filelist:
                if file.filename.startswith("Cout/") and file.file_size > 0:
                    name = file.filename.split("/")[1]
                    cout_files_dict[name] = archive.open(file.filename).read()
                if file.filename.startswith("Code/") and file.file_size > 0:
                    name = file.filename.split("/")[1]
                    code_files_dict[name] = archive.open(file.filename).read()

        pre_feedback = {
            CATEGORY_1: {"category": "תצורת הגשה", "status": {"total": 0, "passed": 0}, "tests": [], "feedback": ""},
            CATEGORY_2: {"category": "תכנות נכון", "status": {"total": 0, "passed": 0}, "tests": [], "feedback": ""},
            CATEGORY_3: {"category": "פונקציונליות", "status": {"total": 0, "passed": 0}, "tests": [], "feedback": ""},
            CATEGORY_4: {"category": "עיצוב ומבנה התוכנית", "status": {"total": 0, "passed": 0}, "tests": [],
                         "feedback": ""},
            CATEGORY_5: {"category": "קריאות וסדר", "status": {"total": 0, "passed": 0}, "tests": [], "feedback": ""},
        }
        new_json = self.createJson(runner_summary, cout_files_dict, taskid)

        for key, value in new_json.items():
            if value["category"] == "config":
                self.add_test_to_category("config", pre_feedback, value)
            elif value["category"] == "progr":
                self.add_test_to_category("progr", pre_feedback, value)
            elif value["category"] == "func":
                self.add_test_to_category("func", pre_feedback, value)
            elif value["category"] == "design":
                self.add_test_to_category("design", pre_feedback, value)
            elif value["category"] == "order":
                self.add_test_to_category("order", pre_feedback, value)

        for key, value in pre_feedback.items():
            value["status"]["percent"] = round(100 / value["status"]["total"] * value["status"]["passed"])
            value["category_eng"] = key

        feedback = list(pre_feedback.values())
        feedback = {
            "categories": feedback,
            "total_feedback": "Dasha good girl"
        }
        print(feedback)

        return self.template_helper.render("manage_feedback.html",
                                           template_folder='/home/darias/Documents/pycharm/INGInious/inginious/frontend/plugins/manager_feedback',
                                           course=course,
                                           task=task,
                                           student=runner_summary["student_name"],
                                           feedback=feedback,
                                           user=manager_userdata,
                                           student_username=username,
                                           students=users,
                                           now=datetime.now())

    def POST_AUTH(self, courseid, taskid, username):
        print("we are here")
        feedback = json.loads(list(flask.request.form.to_dict().keys())[0])
        feedback_json = feedback['categories']
        with codecs.open(
                '/inginious/frontend/plugins/manager_feedback/student_feedback_template.html',
                'r',
                encoding='utf8') as f:
            feedback_html = f.read()
        injected = self.injectHtml(feedback_html, taskid, feedback_json)

        return injected

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

    def createJson(self, runJson, cout_dict, taskid):
        resJson = {}
        for idx, job in enumerate(runJson["pipeline_info"][0]["jobs"]):
            resJson[str(idx)] = {
                "name": job["name"],
                "category": job["category"],
                "exit_code": int(job["message_code"]),
                "link": "",
                "cout": job["cout_file"],
                "message": job["message"],
                "result": {
                    "bool": job["status"] == "Passed",
                    "text": job["status"]
                },
                "prompt": "Gitlab Pipeline",
            }
        print(resJson)
        return resJson

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


def init(plugin_manager, _, _2, _3):
    """ Init the cpp feedback plugin """
    # plugin_manager.add_hook('feedback_menu', add_feedback_menu)
    plugin_manager.add_hook('css', add_css_file)
    plugin_manager.add_hook('css', add_qTip_css_file)
    plugin_manager.add_hook('javascript_header', add_js_file)
    plugin_manager.add_hook('javascript_header', add_qTip_js_file)
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<username>",
                            ManagerFeedbackPage.as_view('manager_feedback'))
    plugin_manager.add_page("/manager_feedback/<courseid>/<taskid>/<username>/<test>", CoutPage.as_view('cout'))
