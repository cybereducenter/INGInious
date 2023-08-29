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
        myjson = json.dumps({"categories": {"submission": {"name": "\u05ea\u05e6\u05d5\u05e8\u05ea \u05d4\u05d2\u05e9\u05d4", "status": {"total": 2, "passed": 0, "percent": 0}, "tests": [{"name": "Verify Submission Date", "category": "submission", "exit_code": 3114, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751067", "cout_file": "/Cout/VerifySubmissionDate.cout", "message": "Vector information is not as expected - check direct access\n operator (Vector::operator[]).", "result": {"bool": False, "text": "running"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Verify Submission", "category": "submission", "exit_code": 1111, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751056", "cout_file": "/Cout/VerifySubmission.cout", "message": "Couldn't initialize a new Queue - check function initQueue().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}, "functionality": {"name": "\u05e4\u05d5\u05e0\u05e7\u05e6\u05d9\u05d5\u05e0\u05dc\u05d9\u05d5\u05ea", "status": {"total": 7, "passed": 0, "percent": 0}, "tests": [{"name": "Part 2 - mem check", "category": "functionality", "exit_code": 9109, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751066", "cout_file": "/Cout/Part2-memcheck.cout", "message": "MMM is in tree but search returned False - check function BSNode::search(std::string).", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Part 2 - test", "category": "functionality", "exit_code": 0, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751065", "cout_file": "/Cout/Part2-test.cout", "message": "Tests passed - good job!.", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Compile Part 2", "category": "functionality", "exit_code": 5201, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751064", "cout_file": "/Cout/CompilePart2.cout", "message": "Arrow object was not initialized as expected - check the following functions: Arrow::Arrow() || Arrow::getArea() || Arrow::getPerimeter() || Arrow::getSource || Arrow::getDestination || Shape::getName || Shape::getType.", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Part 1 - mem check", "category": "functionality", "exit_code": 2205, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751062", "cout_file": "/Cout/Part1-memcheck.cout", "message": "User2 devices should NOT be ON but user2.checkIfDevicesAreOn() returned True -  check function Device::deactivate().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Part 1 - test", "category": "functionality", "exit_code": 10117, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751060", "cout_file": "/Cout/Part1-test.cout", "message": "Items should be compared by serial number - item8 < item7 should return False but got True.", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Compile Part 1", "category": "functionality", "exit_code": 4402, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751059", "cout_file": "/Cout/CompilePart1.cout", "message": "FileHelper information is not as expected - check static functions FileHelper::readFileToString() || FileHelper::saveTextInFile().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Verify Necessary Exercise Files", "category": "functionality", "exit_code": 2401, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4970751058", "cout_file": "/Cout/VerifyNecessaryExerciseFiles.cout", "message": "Couldn't initialize a new Social Network - check if the social network is initialized properly.", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}, "coding": {"name": "\u05ea\u05db\u05e0\u05d5\u05ea \u05e0\u05db\u05d5\u05df", "status": {"total": 0, "passed": 0, "percent": 0}, "tests": [], "feedback": "", "selected": False}, "design": {"name": "\u05e2\u05d9\u05e6\u05d5\u05d1 \u05d5\u05de\u05d1\u05e0\u05d4 \u05d4\u05ea\u05d5\u05db\u05e0\u05d9\u05ea", "status": {"total": 1, "passed": 1, "percent": 100}, "tests": [{"name": "ChatGPT test 1", "category": "design", "exit_code": 0, "link": None, "cout_file": "", "message": "Job succeeded, good job! :)", "result": {"bool": True, "text": "Passed"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}, "readability": {"name": "\u05e7\u05e8\u05d9\u05d0\u05d5\u05ea \u05d5\u05e1\u05d3\u05e8", "status": {"total": 1, "passed": 0, "percent": 0}, "tests": [{"name": "ChatGPT test 2", "category": "readability", "exit_code": 1, "link": None, "cout_file": "", "message": "No deadlines were configured, skipping, please ask instructor to set deadline for this exercise", "result": {"bool": False, "text": "Failed"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}}, "total_feedback": "", "draft": True})
        # myjson = json.dumps({"categories": {"submission": {"name": "\u05ea\u05e6\u05d5\u05e8\u05ea \u05d4\u05d2\u05e9\u05d4", "status": {"total": 2, "passed": 0, "percent": 0}, "tests": [{"name": "Verify Submission Date", "category": "submission", "exit_code": 2103, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434914", "cout_file": "/Cout/VerifySubmissionDate.cout", "message": "Called device1.activate() - device should not active but isActive() returned False.", "result": {"bool": False, "text": "running"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Verify Submission", "category": "submission", "exit_code": 3122, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434873", "cout_file": "/Cout/VerifySubmission.cout", "message": "Vector information is not as expected - check substruction operator (Vector::operator-=).", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}, "functionality": {"name": "\u05e4\u05d5\u05e0\u05e7\u05e6\u05d9\u05d5\u05e0\u05dc\u05d9\u05d5\u05ea", "status": {"total": 7, "passed": 0, "percent": 0}, "tests": [{"name": "Part 2 - mem check", "category": "functionality", "exit_code": 1211, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434910", "cout_file": "/Cout/Part2-memcheck.cout", "message": "Couldn't initialize a new Stack - check function initStack().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Part 2 - test", "category": "functionality", "exit_code": 1123, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434907", "cout_file": "/Cout/Part2-test.cout", "message": "First queue should not be empty but isEmpty() returned True.", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Compile Part 2", "category": "functionality", "exit_code": 2311, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434902", "cout_file": "/Cout/CompilePart2.cout", "message": "All words in the status should be 'Magshimim' - check function Profile::changeAllWordsInStatus().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Part 1 - mem check", "category": "functionality", "exit_code": 2311, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434897", "cout_file": "/Cout/Part1-memcheck.cout", "message": "All words in the status should be 'Magshimim' - check function Profile::changeAllWordsInStatus().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Part 1 - test", "category": "functionality", "exit_code": 2303, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434892", "cout_file": "/Cout/Part1-test.cout", "message": ""Got bad results from function getFriendsWithSameNameLength() for Gal's profile - result should be 'Avi", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Compile Part 1", "category": "functionality", "exit_code": 3107, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434887", "cout_file": "/Cout/CompilePart1.cout", "message": "All elements in vector v1 were popped but method empty() returned False - check function Vector::empty().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}, {"name": "Verify Necessary Exercise Files", "category": "functionality", "exit_code": 1212, "link": "https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434880", "cout_file": "/Cout/VerifyNecessaryExerciseFiles.cout", "message": "A new Stack was created - stack should be empty but isEmpty() returned False.", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}, "coding": {"name": "\u05ea\u05db\u05e0\u05d5\u05ea \u05e0\u05db\u05d5\u05df", "status": {"total": 0, "passed": 0, "percent": 0}, "tests": [], "feedback": "", "selected": False}, "design": {"name": "\u05e2\u05d9\u05e6\u05d5\u05d1 \u05d5\u05de\u05d1\u05e0\u05d4 \u05d4\u05ea\u05d5\u05db\u05e0\u05d9\u05ea", "status": {"total": 1, "passed": 1, "percent": 100}, "tests": [{"name": "ChatGPT test 1", "category": "design", "exit_code": 0, "link": None, "cout_file": "", "message": "Job succeeded, good job! :)", "result": {"bool": True, "text": "Passed"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}, "readability": {"name": "\u05e7\u05e8\u05d9\u05d0\u05d5\u05ea \u05d5\u05e1\u05d3\u05e8", "status": {"total": 1, "passed": 0, "percent": 0}, "tests": [{"name": "ChatGPT test 2", "category": "readability", "exit_code": 1, "link": None, "cout_file": "", "message": "No deadlines were configured, skipping, please ask instructor to set deadline for this exercise", "result": {"bool": False, "text": "Failed"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}}, "total_feedback": "", "draft": True})
        # myjson = json.dumps({"categories": {"submission": {"name": "\u05ea\u05e6\u05d5\u05e8\u05ea \u05d4\u05d2\u05e9\u05d4", "status": {"total": 2, "passed": 0, "percent": 0}, "tests": [{"name": "Verify Submission", "category": "submission", "exit_code": 1111, "message": "Couldn't initialize a new Queue - check function initQueue().", "result": {"bool": False, "text": "created"}, "prompt": "Gitlab Pipeline", "selected": False}], "feedback": "", "selected": False}}, "total_feedback": "", "draft": True})
        # myjson = "{\"categories\": {\"submission\": {\"name\": \"\\u05ea\\u05e6\\u05d5\\u05e8\\u05ea \\u05d4\\u05d2\\u05e9\\u05d4\", \"status\": {\"total\": 2, \"passed\": 0, \"percent\": 0}, \"tests\": [{\"name\": \"Verify Submission Date\", \"category\": \"submission\", \"exit_code\": 2103, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434914\", \"cout_file\": \"/Cout/VerifySubmissionDate.cout\", \"message\": \"Called device1.activate() - device should not active but isActive() returned false.\", \"result\": {\"bool\": false, \"text\": \"running\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}, {\"name\": \"Verify Submission\", \"category\": \"submission\", \"exit_code\": 3122, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434873\", \"cout_file\": \"/Cout/VerifySubmission.cout\", \"message\": \"Vector information is not as expected - check substruction operator (Vector::operator-=).\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}], \"feedback\": \"\", \"selected\": false}, \"functionality\": {\"name\": \"\\u05e4\\u05d5\\u05e0\\u05e7\\u05e6\\u05d9\\u05d5\\u05e0\\u05dc\\u05d9\\u05d5\\u05ea\", \"status\": {\"total\": 7, \"passed\": 0, \"percent\": 0}, \"tests\": [{\"name\": \"Part 2 - mem check\", \"category\": \"functionality\", \"exit_code\": 1211, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434910\", \"cout_file\": \"/Cout/Part2-memcheck.cout\", \"message\": \"Couldn't initialize a new Stack - check function initStack().\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}, {\"name\": \"Part 2 - test\", \"category\": \"functionality\", \"exit_code\": 1123, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434907\", \"cout_file\": \"/Cout/Part2-test.cout\", \"message\": \"First queue should not be empty but isEmpty() returned true.\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}, {\"name\": \"Compile Part 2\", \"category\": \"functionality\", \"exit_code\": 2311, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434902\", \"cout_file\": \"/Cout/CompilePart2.cout\", \"message\": \"All words in the status should be 'Magshimim' - check function Profile::changeAllWordsInStatus().\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}, {\"name\": \"Part 1 - mem check\", \"category\": \"functionality\", \"exit_code\": 2311, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434897\", \"cout_file\": \"/Cout/Part1-memcheck.cout\", \"message\": \"All words in the status should be 'Magshimim' - check function Profile::changeAllWordsInStatus().\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}, {\"name\": \"Part 1 - test\", \"category\": \"functionality\", \"exit_code\": 2303, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434892\", \"cout_file\": \"/Cout/Part1-test.cout\", \"message\": \"\\\"Got bad results from function getFriendsWithSameNameLength() for Gal's profile - result should be 'Avi\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}, {\"name\": \"Compile Part 1\", \"category\": \"functionality\", \"exit_code\": 3107, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434887\", \"cout_file\": \"/Cout/CompilePart1.cout\", \"message\": \"All elements in vector v1 were popped but method empty() returned false - check function Vector::empty().\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}, {\"name\": \"Verify Necessary Exercise Files\", \"category\": \"functionality\", \"exit_code\": 1212, \"link\": \"https://gitlab.com/commit_testenv2023/herzlya/a_5290719/Herzlya_a_5290719_Ex01/-/jobs/4973434880\", \"cout_file\": \"/Cout/VerifyNecessaryExerciseFiles.cout\", \"message\": \"A new Stack was created - stack should be empty but isEmpty() returned false.\", \"result\": {\"bool\": false, \"text\": \"created\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}], \"feedback\": \"\", \"selected\": false}, \"coding\": {\"name\": \"\\u05ea\\u05db\\u05e0\\u05d5\\u05ea \\u05e0\\u05db\\u05d5\\u05df\", \"status\": {\"total\": 0, \"passed\": 0, \"percent\": 0}, \"tests\": [], \"feedback\": \"\", \"selected\": false}, \"design\": {\"name\": \"\\u05e2\\u05d9\\u05e6\\u05d5\\u05d1 \\u05d5\\u05de\\u05d1\\u05e0\\u05d4 \\u05d4\\u05ea\\u05d5\\u05db\\u05e0\\u05d9\\u05ea\", \"status\": {\"total\": 1, \"passed\": 1, \"percent\": 100}, \"tests\": [{\"name\": \"ChatGPT test 1\", \"category\": \"design\", \"exit_code\": 0, \"link\": null, \"cout_file\": \"\", \"message\": \"Job succeeded, good job! :)\", \"result\": {\"bool\": true, \"text\": \"Passed\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}], \"feedback\": \"\", \"selected\": false}, \"readability\": {\"name\": \"\\u05e7\\u05e8\\u05d9\\u05d0\\u05d5\\u05ea \\u05d5\\u05e1\\u05d3\\u05e8\", \"status\": {\"total\": 1, \"passed\": 0, \"percent\": 0}, \"tests\": [{\"name\": \"ChatGPT test 2\", \"category\": \"readability\", \"exit_code\": 1, \"link\": null, \"cout_file\": \"\", \"message\": \"No deadlines were configured, skipping, please ask instructor to set deadline for this exercise\", \"result\": {\"bool\": false, \"text\": \"Failed\"}, \"prompt\": \"Gitlab Pipeline\", \"selected\": false}], \"feedback\": \"\", \"selected\": false}}, \"total_feedback\": \"\", \"draft\": true}"
        print(myjson)
        submission = self.submission_manager._database.submissions.find_one_and_update(
            {"_id": submission["_id"]},
            {"$set": {"custom": {'feedback_data': myjson}, 'text': 'No feedback'}},
            return_document=ReturnDocument.AFTER
        )
        submission_feedback = json.loads(submission['custom']['feedback_data'])
        print(submission_feedback)
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
