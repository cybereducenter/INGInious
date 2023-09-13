# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Matrix plugin - show course overview of student grades """
import json
from collections import OrderedDict
from datetime import datetime

import bson
import flask
import pymongo

from inginious.common.tasks_constants import TaskConstants
from inginious.frontend.matrix_service import get_course_students
from inginious.frontend.pages.api._api_page import APIInvalidArguments, APIError
from inginious.frontend.pages.course_admin.utils import INGIniousAdminPage, calculate_time_passed_since


class MatrixPage(INGIniousAdminPage):
    def GET_AUTH(self, courseid):  # pylint: disable=arguments-differ
        """ GET request """
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        course_type = list(course.get_tasks().values())[0]._type
        data_users = []

        """ Get all information about the users """
        users = get_course_students(course, self.user_manager)

        """ Reorder course tasks according to deadline from past to future, no deadline and passed deadline """
        self._get_ordered_task_raz(course)
        order_tasks, first_id = self._get_ordered_task(course)

        """ Get all user tasks """
        for user in users:
            data_user = self._calc_user_data(course, order_tasks, users[user])
            data_users.append(data_user)

        if first_id:
            first_id = first_id.get_id()
        else:
            first_id = 0

        return self.template_helper.render("admin.html",
                                           template_folder='frontend/plugins/matrix',
                                           course=course,
                                           course_type=course_type,
                                           data_users=data_users,
                                           order_tasks=order_tasks,
                                           possible_grades=TaskConstants.ORDERED_GRADE_COLORS_RANGE,
                                           first_id=first_id,
                                           now=datetime.now())

    def _get_ordered_task_raz(self, course):
        now = datetime.now().date()
        tasks = course.get_tasks()

        # calc next deadline
        next_deadline_first_ix = 0
        next_deadline_last_ix = len(tasks)
        for i, task in enumerate(tasks):
            end_date = tasks[task].get_accessible_time().get_end_date().date()
            if now <= end_date < datetime.max.date():
                next_deadline_first_ix = i
                break
        for i, task in enumerate(tasks):
            end_date = tasks[task].get_accessible_time().get_end_date().date()
            if now <= end_date < datetime.max.date():
                next_deadline_last_ix = i

        ordered_task = []
        for i, task in enumerate(tasks):
            if i in range(next_deadline_first_ix, next_deadline_last_ix + 1):
                ordered_task.append(tasks[task])
        for i, task in enumerate(tasks):
            if i in range(next_deadline_last_ix + 1, len(tasks)):
                ordered_task.append(tasks[task])
        for i, task in enumerate(tasks):
            if i in range(next_deadline_first_ix):
                ordered_task.append(tasks[task])

        self.logger.info(f'first_ix = {next_deadline_first_ix}, last_ix = {next_deadline_last_ix}')
        for i, task in enumerate(ordered_task):
            end_date = task.get_accessible_time().get_end_date().date()
            self.logger.info(f'{i:2} - {end_date} - {task.get_id()}')
        return

    def _get_ordered_task(self, course):
        """ Reorder course tasks according to deadline from past to future, no deadline and passed deadline """
        tasks = course.get_tasks()
        past_future_tasks = []
        past_tasks = []
        future_tasks = []
        always_tasks = []
        never_tasks = []
        for task in tasks:
            # todo, extract strings to constants
            if tasks[task].get_deadline() == 'No deadline':
                """ Tasks with no deadline, that will always show in tasks """
                always_tasks.append(tasks[task])
            elif tasks[task].get_deadline() == "It's too late":
                """ Tasks that will never show in tasks """
                never_tasks.append(tasks[task])
            else:
                now = datetime.now()

                if tasks[task].get_accessible_time().get_start_date() < now:
                    if tasks[task].get_accessible_time().get_end_date() < now:
                        """ Past tasks that will show in the beginning """
                        past_tasks.append(tasks[task])
                    else:
                        """ Past future tasks that will show at the end """
                        past_future_tasks.append(tasks[task])
                elif tasks[task].get_accessible_time().get_start_date() > now \
                        and tasks[task].get_accessible_time().get_end_date() > now:
                    """ Future tasks that will not show in tasks """
                    future_tasks.append(tasks[task])

        tasks_with_future_deadline = past_future_tasks + future_tasks

        """ Sort By Deadline """
        tasks_with_future_deadline = sorted(tasks_with_future_deadline,
                                            key=lambda x: x.get_accessible_time().get_end_date(), reverse=True)
        past_tasks = sorted(past_tasks, key=lambda x: x.get_accessible_time().get_end_date(), reverse=True)

        order_tasks = tasks_with_future_deadline + always_tasks + past_tasks + never_tasks

        if past_tasks:
            return order_tasks, past_tasks[0]
        elif never_tasks:
            return order_tasks, never_tasks[0]
        else:
            return order_tasks, None

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
                    has_feedback_data = True if user_task_latest_submission['custom'].get("feedback_data") else False
                    task_for_user['submission_data'] = {'url': href_to_submissions, 'time_passed': time_passed,
                                                        'has_feedback_data': has_feedback_data}

        return ordered_tasks_for_user

    def _build_student_submissions_url(self, course_name, student_name, task_name):
        return '/admin/' + course_name + '/submissions?tasks=' + task_name + '&users=' + student_name


def _get_user_task_submissions(self, username, course_id):
    """
    get all the relevant submissions - the last ones and not the ones with the highest score
    group by taskid and select the latest one,
    since we are sorting by date, the first we'll encounter
    will be the latest one
    """
    user_task_submissions = list(self.database.submissions.find({"username": username, "courseid": course_id})
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
    return ('/static/plugins/matrix/matrix.css')  ### TODO - change ###


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
        if not task._data.get('feedback', False):
            self.logger.error(f'Task {taskid} is not feedback task!')
            raise APIInvalidArguments()
        selected_students = flask.request.json.get('student', [])
        all_students = self.get_course_users(course)
        students_to_merge = []
        if selected_students:
            for username in selected_students:
                if username not in all_students.keys():
                    self.logger.error(f'Student {username} not in course {courseid}!')
                    raise APIInvalidArguments()
                students_to_merge.append(username)
        else:
            students_to_merge.extend(all_students.values())

        for username, student in all_students.items():
            user_task_submissions_by_task_id = _get_user_task_submissions(self, username, courseid)

            user_input = {'@action': 'submit'}
            feedback_data = {}
            for problem in task.get_problems():
                source_task_id = problem.get_id()  # pid = task_id
                user_task_latest_submission = user_task_submissions_by_task_id.get(source_task_id)
                if user_task_latest_submission:
                    user_input[source_task_id] = user_task_latest_submission
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
                                feedback_categories[category]['status']['total'] += data['status']['total']
                                feedback_categories[category]['status']['passed'] += data['status']['passed']
                                feedback_categories[category]['status']['percent'] += data['status']['percent']

            # user_input = task.adapt_input_for_backend(user_input)
            # if not task.input_is_consistent(user_input, self.default_allowed_file_extensions,
            #                                 self.default_max_file_size):
            #     raise APIInvalidArguments()
            self.user_manager.user_saw_task(username, courseid, source_task_id)

            # Verify rights
            # if not self.user_manager.task_can_user_submit(task, username=username, only_check='groups'):
            #     raise APIForbidden("You are not allowed to submit for this task")

            try:
                submission_id, _ = self.add_submission_job(task, user_input, True, username, student['email'], feedback_data)
            except Exception as ex:
                self.logger.error(f'Failed to create submission job for user {username}, error: {ex}')
                raise APIError(500, str(ex))
            # submission = self.submission_manager.get_submission(submission_id, user_check=False)
        return 'ok'

    def get_course_users(self, course):
        students = list(
            self.user_manager.get_users_info(
                self.user_manager.get_course_registered_users(course, False)
            ).items()
        )
        return dict(students)

    def add_submission_job(self, task, inputdata, debug, username, email, feedback_data):
        """
        Add a job in the queue and returns a submission id.
        :param task:  Task instance
        :type task: inginious.frontend.tasks.Task
        :param inputdata: the input as a dictionary
        :type inputdata: dict
        :param debug: If debug is true, more debug data will be saved
        :type debug: bool or string
        :param username: student username
        :type username: string
        :param email: student email
        :type email: string
        :returns: the new submission id and the removed submission id
        """

        # Prevent student from submitting several submissions together
        waiting_submission = self.database.submissions.find_one({
            "courseid": task.get_course_id(),
            "taskid": task.get_id(),
            "username": username,
            "status": "waiting"})

        if waiting_submission is not None:
            raise Exception("A submission is already pending for this task!")

        obj = {
            "courseid": task.get_course_id(),
            "taskid": task.get_id(),
            "status": "waiting",
            "submitted_on": datetime.now(),
            "username": [username],
            "response_type": task.get_response_type(),
            "user_ip": flask.request.remote_addr
        }

        inputdata["@username"] = username
        inputdata["@email"] = email
        inputdata["@lang"] = self.user_manager.session_language()
        inputdata["@time"] = str(obj["submitted_on"])
        inputdata["@taskid"] = task.get_id()
        my_user_task = self.database.user_tasks.find_one(
            {"courseid": task.get_course_id(), "taskid": task.get_id(), "username": username}, {"tried": 1, "_id": 0})
        tried_count = my_user_task["tried"]
        inputdata["@attempts"] = str(tried_count + 1)
        # Retrieve input random
        states = self.database.user_tasks.find_one(
            {"courseid": task.get_course_id(), "taskid": task.get_id(), "username": username},
            {"random": 1, "state": 1})
        inputdata["@random"] = states["random"] if "random" in states else []
        inputdata["@state"] = states["state"] if "state" in states else ""

        self.plugin_manager.call_hook("new_submission", submission=obj, inputdata=inputdata)

        self.submission_manager._before_submission_insertion(task, inputdata, debug, obj)
        obj["input"] = self.submission_manager._gridfs.put(bson.BSON.encode(inputdata))
        submissionid = self.database.submissions.insert_one(obj).inserted_id
        to_remove = self._after_submission_insertion(task, inputdata, debug, obj, submissionid)

        ssh_callback = lambda host, port, user, password: \
            self.submission_manager._handle_ssh_callback(submissionid,
                                                         host, port, user,
                                                         password)
        jobid = self.submission_manager._client.new_job(0, task, inputdata,
                                                        (lambda result, grade, problems, tests, custom, state, archive,
                                                                stdout, stderr:
                                                         self.submission_manager._job_done_callback(submissionid, task,
                                                                                                    result, grade,
                                                                                                    problems, tests,
                                                                                                    custom, state,
                                                                                                    archive, stdout,
                                                                                                    stderr, True)),
                                                        "Frontend - {}".format(username), debug, ssh_callback)

        self.database.submissions.update_one(
            {"_id": submissionid, "status": "waiting"},
            {"$set": {"jobid": jobid, "custom": {"feedback_data": feedback_data}}}
        )

        self.logger.info("New submission from %s - %s - %s/%s - %s", username, email, task.get_course_id(),
                         task.get_id(), flask.request.remote_addr)

        return submissionid, to_remove


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
