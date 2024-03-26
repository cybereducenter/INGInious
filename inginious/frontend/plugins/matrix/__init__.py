# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Matrix plugin - show course overview of student grades """
import json
from collections import OrderedDict
from datetime import datetime
import logging
import bson
import flask
import pymongo
from flask import Flask

from inginious.common.tasks_constants import TaskConstants
from inginious.frontend.matrix_service import get_course_students
from inginious.frontend.pages.api._api_page import APIInvalidArguments, APIError
from inginious.frontend.pages.course_admin.utils import INGIniousAdminPage, calculate_time_passed_since
from inginious.frontend.submission_manager import AddJobStrategy

class MatrixPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid): # pylint: disable=arguments-differ
        """ GET request """
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        course_type = list(course.get_tasks().values())[0]._type
        data_users = []

        """ Get all information about the users """
        users = get_course_students(course, self.user_manager)

        # users = sorted(list(
        #     self.user_manager.get_users_info(self.user_manager.get_course_registered_users(course, False)).items()),
        #                key=lambda k: k[1][0] if k[1] is not None else "")

        # users = OrderedDict([(user[0], {"username": user[0],
        #                              "realname": user[1][0] if user[1] is not None else None}) for user in users])

        """ Reorder course tasks according to deadline from past to future, no deadline and passed deadline """
        future_tasks, first_past_task, past_tasks = self._get_ordered_task_simplified(course)
        order_tasks = future_tasks + past_tasks

        # Special task categories, to be highlighted on the column header row
        inspected_tasks = len([t for t in order_tasks if "inspected" in t.get_categories()]) > 0
        bonus_tasks = len([t for t in order_tasks if "bonus" in t.get_categories()]) > 0
        continuous_tasks = len([t for t in order_tasks if "continuous" in t.get_categories()]) > 0

        """ Get all user tasks """
        for user in users:
            data_user = self._calc_user_data(course, future_tasks + past_tasks, users[user])
            data_users.append(data_user)

        if first_past_task is not None:
            first_id = first_past_task.get_id()
        else:
            first_id = None

        return self.template_helper.render("admin.html", 
                                           template_folder='frontend/plugins/matrix',
                                           course=course, 
                                           course_type=course_type,
                                           data_users=data_users, 
                                           order_tasks=order_tasks,
                                           past_tasks=past_tasks, 
                                           future_tasks=future_tasks,
                                           inspected_tasks=inspected_tasks,
                                           bonus_tasks=bonus_tasks,
                                           continuous_tasks=continuous_tasks,
                                           possible_grades=TaskConstants.ORDERED_GRADE_COLORS_RANGE,
                                           first_id=first_id,                                           
                                           now=datetime.now())

    def _get_ordered_task_simplified(self, course):
        '''
        This function arranges the list of tasks, to be used as column headers for the matrix.
        It does NOT change the natural (alphabetical) order of the list, only makingh it circular, 
        where past due tasks are moved to the end of the list.
        '''
        now = datetime.now().date()
        tasks = course.get_tasks(ordered=True)        
        
        # Find first task with end date not in the past
        for first_future_ix, task in enumerate(tasks):
            end_date = tasks[task].get_accessible_time().get_end_date().date()
            if end_date >= now:
                break              

        future_tasks = []
        for i, task in enumerate(tasks):
            if i >= first_future_ix:
                future_tasks.append(tasks[task])      
        
        first_past_task = None
        past_tasks = []
        for i, task in enumerate(tasks):
            if i < first_future_ix:
                past_tasks.append(tasks[task])
                if first_past_task is None:
                    first_past_task = tasks[task]

        return future_tasks, first_past_task, past_tasks
    
        
    # def _get_ordered_task(self, course):
    #     """ Reorder course tasks according to deadline from past to future, no deadline and passed deadline """
    #     tasks = course.get_tasks()
    #     past_future_tasks = []
    #     past_tasks = []
    #     future_tasks = []
    #     always_tasks = []
    #     never_tasks = []
    #     for task in tasks:
    #         # todo, extract strings to constants
    #         if tasks[task].get_deadline() == 'No deadline':
    #             """ Tasks with no deadline, that will always show in tasks """
    #             always_tasks.append(tasks[task])
    #         elif tasks[task].get_deadline() == "It's too late":
    #             """ Tasks that will never show in tasks """
    #             never_tasks.append(tasks[task])
    #         else:
    #             now = datetime.now()

    #             if tasks[task].get_accessible_time().get_start_date() < now:
    #                 if tasks[task].get_accessible_time().get_end_date() < now:
    #                     """ Past tasks that will show in the beginning """
    #                     past_tasks.append(tasks[task])
    #                 else:
    #                     """ Past future tasks that will show at the end """
    #                     past_future_tasks.append(tasks[task])
    #             elif tasks[task].get_accessible_time().get_start_date() > now \
    #                     and tasks[task].get_accessible_time().get_end_date() > now:
    #                 """ Future tasks that will not show in tasks """
    #                 future_tasks.append(tasks[task])

    #     tasks_with_future_deadline = past_future_tasks + future_tasks

    #     """ Sort By Deadline """
    #     tasks_with_future_deadline = sorted(tasks_with_future_deadline, key=lambda x: x.get_accessible_time().get_end_date(), reverse=True)
    #     past_tasks = sorted(past_tasks, key=lambda x: x.get_accessible_time().get_end_date(), reverse=True)

    #     order_tasks = tasks_with_future_deadline + always_tasks + past_tasks + never_tasks
        
    #     if past_tasks:
    #         return order_tasks, past_tasks[0]
    #     elif never_tasks:
    #         return order_tasks, never_tasks[0]
    #     else:
    #         return order_tasks, None

    def _calc_user_data(self, course, order_tasks, user_data):
        username = user_data['username']
        course_id = course.get_id()
        lang = self.user_manager.session_language()
        ordered_tasks_for_user = OrderedDict([(taskid.get_id(), {"taskid": taskid,
                                                                 "name": taskid.get_name(lang),
                                                                 "tried": 0,
                                                                 "status": TaskConstants.DEFAULT_STATUS,
                                                                 "grade": 0}) for taskid in order_tasks])

        user_tasks = list(self.database.user_tasks.find({"username": username, "courseid": course_id}))
        user_task_submissions_by_task_id = _get_user_task_submissions(self, username, course_id)

        # tasks = course.get_tasks()        
        # for task in tasks:
        #     start_date = tasks[task].get_accessible_time().get_start_date()
        #     if start_date == datetime.max:
        #         ordered_tasks_for_user[task]['status'] = 'notaccessible'
        
        ordered_tasks_for_user = self._calculate_user_tasks(
                                    user_tasks, ordered_tasks_for_user,
                                    user_task_submissions_by_task_id, course_id, username)

        data_user = {'name': user_data, 'tasks': ordered_tasks_for_user}
        return data_user

    def _calculate_user_tasks(self, user_tasks, ordered_tasks_for_user,
                              user_task_submissions_by_task_id, course_name, student_name):
        for user_task in user_tasks:
            task_id = user_task["taskid"]

            if task_id in ordered_tasks_for_user:
                task_for_user = ordered_tasks_for_user[task_id]
                user_grade = user_task["grade"]
                task_for_user["tried"] = user_task["tried"]
                if user_task["tried"] == 0:
                    task_for_user["status"] = "notattempted"
                else:
                    task_for_user["status"] = \
                        self.task_factory.get_relevant_color_class_for_grade(user_grade)

                task_for_user["grade"] = user_task["grade"]
                task_for_user["submissionid"] = str(user_task["submissionid"])
                # take the submission id from the task (will be the last submitted ) and query the submission 'submissionid'
                user_task_latest_submission = user_task_submissions_by_task_id.get(task_id)
                if user_task_latest_submission:
                    # link to the all submissions page, for example /admin/tutorial/student/ohad/03_tasks
                    href_to_submissions = self._build_student_submissions_url(course_name, student_name, task_id)
                    time_passed = calculate_time_passed_since(user_task_latest_submission["submitted_on"])
                    draft = True
                    has_feedback_data = False
                    custom = user_task_latest_submission.get('custom')
                    if custom is not None:
                        feeddback_data = custom.get('feedback_data')
                        extra_feeddback_data = custom.get('extra_feedback_data')
                        has_feedback_data = (feeddback_data is not None) or (extra_feeddback_data is not None)
                        if feeddback_data is not None:
                            draft = feeddback_data['draft'] if 'draft' in feeddback_data.keys() else False
                            logging.info(f'draft= {draft}')

                    # has_feedback_data = (bool(user_task_latest_submission.get('custom'))
                    #                      and bool(user_task_latest_submission['custom'].get("feedback_data")
                    #                               or user_task_latest_submission['custom'].get("extra_feedback_data")))
                    task_for_user['submission_data'] = {'url': href_to_submissions, 
                                                        'time_passed':  time_passed,
                                                        'has_feedback_data': has_feedback_data,
                                                        'draft': draft}

        return ordered_tasks_for_user

    def _build_student_submissions_url(self, course_name, student_name, task_name):
          return '/admin/'+ course_name + '/submissions?tasks=' + task_name + '&users=' + student_name


def _get_user_task_submissions(self, username, course_id):
    '''
    get all the relevant submissions - the last ones and not the ones with the highest score
    group by taskid and select the latest one,
    since we are sorting by date, the first we'll encounter
    will be the latest one
    '''
    user_task_submissions = list(self.database.submissions.find({"username":  username, "courseid": course_id})
                                    .sort([("submitted_on", pymongo.DESCENDING)]))

    user_task_submissions_by_task_id = {}
    for user_task_submission in user_task_submissions:
        task_id = user_task_submission['taskid']
        if not user_task_submissions_by_task_id.get(task_id):
            user_task_submissions_by_task_id[task_id] = user_task_submission

    return user_task_submissions_by_task_id


def add_admin_menu(course):
    """ Add matrix setting to the admin panel """
    return ('matrix', '<i class="fa fa-graduation-cap fa-fw"></i>&nbsp; Matrix')


def add_course_menu(course, template_helper):
    """ Add matrix setting to the course panel """
    html = f'''
        <div class="list-group">
            <a class="list-group-item list-group-item-action list-group-item-info" href="{flask.request.url_root}/admin/{course.get_id()}/matrix">
            <i class="fa fa-graduation-cap fa-fw"></i>&nbsp; Matrix
            </a>
        </div>
    '''
    return html


def add_css_file():
    """ Add matrix css file to the admin page """
    return ('/static/plugins/matrix/matrix.css') ### TODO - change ###


def add_js_file():
    """ Add matrix js file to the admin page """
    return '/static/plugins/matrix/matrix.js'


def add_qTip_css_file():
    """ Add matrix css file to the admin page """
    return 'https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.css'


def add_qTip_js_file():
    """ Add matrix js file to the admin page """
    return 'https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.js'

class MergeFeedbackPage(INGIniousAdminPage):
    def POST_AUTH(self, courseid, taskid):
        course, task = self.get_course_and_check_rights(courseid, taskid=taskid, allow_all_staff=True)
        if not task._data.get('feedback'):
            self.logger.error(f'Task {taskid} is not feedback task!')
            raise APIInvalidArguments()
        selected_students = flask.request.json.get('student', [])
        all_students = self.get_course_users(course)
        students_to_merge = {}
        if selected_students:
            for username in selected_students:
                if username not in all_students.keys():
                    self.logger.error(f'Student {username} not in course {courseid}!')
                    raise APIInvalidArguments()
                students_to_merge[username] = all_students[username]
        else:
            students_to_merge = all_students

        submission_ids = {}
        for username, student in students_to_merge.items():
            user_task_submissions_by_task_id = _get_user_task_submissions(self, username, courseid)

            user_input = {'@action': 'submit'}
            feedback_data = {}
            for problem in task.get_problems():
                source_task_id = problem.get_id()  # pid = task_id
                user_task_latest_submission = user_task_submissions_by_task_id.get(source_task_id)
                if user_task_latest_submission:
                    user_input[source_task_id] = self.submission_manager.get_input_from_submission(user_task_latest_submission)['input']['program']
                    latest_submission_feedback = user_task_latest_submission['custom'].get('feedback_data', {})
                    if latest_submission_feedback and not feedback_data:
                        feedback_data = latest_submission_feedback
                    elif latest_submission_feedback:
                        feedback_categories = feedback_data['categories']
                        for category, data in latest_submission_feedback['categories'].items():
                            if category not in feedback_categories:
                                feedback_categories[category] = data
                            else:
                                feedback_categories[category]['tests'].extend(data['tests'])
                            feedback_categories[category]['status']['total'] = len(feedback_categories[category]['tests'])
                            feedback_categories[category]['status']['passed'] = len([t for t in feedback_categories[category]['tests'] if t['result']['bool']])
                            feedback_categories[category]['status']['percent'] = int(
                                    100 * feedback_categories[category]['status']['passed'] / feedback_categories[category]['status']['total']
                                ) if feedback_categories[category]['status']['total'] else 0

            # user_input = task.adapt_input_for_backend(user_input)
            # if not task.input_is_consistent(user_input, self.default_allowed_file_extensions, self.default_max_file_size):
            #     raise APIInvalidArguments()
            self.user_manager.user_saw_task(username, courseid, task.get_id())

            try:
                submission_id, _ = self.submission_manager.add_job(task, user_input, True,
                                                                   ExtraStrategy(username=username,
                                                                                 email=student.email,
                                                                                 feedback=feedback_data))
                submission_ids[username] = str(submission_id)
            except Exception as ex:
                self.logger.error(f'Failed to create submission job for user {username}, error: {ex}')
                raise APIError(500, str(ex))
            # submission = self.submission_manager.get_submission(submission_id, user_check=False)
        return submission_ids


    def get_course_users(self, course):
        students = list(
            self.user_manager.get_users_info(
                self.user_manager.get_course_registered_users(course, False)
            ).items()
        )
        return dict(students)


class ExtraStrategy(AddJobStrategy):
    def __init__(self, username, email, feedback):
        self.username = username
        self.email = email
        self.feedback_data = feedback

    def get_username(self):
        return self.username

    def get_email(self):
        return self.email

    def add_feedback_data(self):
        return self.feedback_data


def init(plugin_manager, _, _2, _3):
    """ Init the matrix plugin """
    plugin_manager.add_hook('course_menu', add_course_menu)
    plugin_manager.add_hook('course_admin_menu', add_admin_menu)
    plugin_manager.add_hook('css', add_css_file)
    plugin_manager.add_hook('css', add_qTip_css_file)
    plugin_manager.add_hook('javascript_header', add_js_file)
    plugin_manager.add_hook('javascript_header', add_qTip_js_file)
    plugin_manager.add_page("/admin/<courseid>/matrix", MatrixPage.as_view('matrtix'))
    plugin_manager.add_page("/admin/<courseid>/<taskid>/merge_feedback", MergeFeedbackPage.as_view('merge_feedback'))