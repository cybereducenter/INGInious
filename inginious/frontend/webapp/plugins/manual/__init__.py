import web
from collections import OrderedDict
from inginious.frontend.webapp.pages.course_admin.utils import INGIniousAdminPage, get_task_and_lesson
from inginious.frontend.webapp.pages.tasks import TaskPage as OriginalTaskPage
import json
from datetime import datetime
import os
import pdfkit
import tempfile

MANUAL_DIR_PATH = os.path.dirname(os.path.abspath(__file__))

class ManualPlugin(INGIniousAdminPage):
    """ Manual plugin - show overall feedback about student """
    """ Get all information about the users """
    def get_users(self, course):
        users = sorted(list(
            self.user_manager.get_users_info(self.user_manager.get_course_registered_users(course, False)).items()),
            key=lambda k: k[1][0] if k[1] is not None else "")

        users = OrderedDict([(user[0], {"username": user[0],
                                        "realname": user[1][0] if user[1] is not None else None}) for user in users])

        return users

    """ Get all lessons """
    def get_lessons(self, course):
        tasks = course.get_tasks()
        lessons_list = set()
        lessons = []

        for task in tasks:
            lessons_list.add(get_task_and_lesson(task)[0])

        if lessons_list:
            # sorted_lessons = sorted(lessons_list, key=int)
            sorted_lessons = sorted(lessons_list)
            lessons = OrderedDict([(lesson, {"name": lesson,
                                             "tasks": []}) for lesson in sorted_lessons])
        for task in tasks:
            lesson_num, task_num = get_task_and_lesson(task)

            lessons[lesson_num]['tasks'].append({"id": task_num,
                                                 "taskid": tasks[task]})

        return lessons

    def get_buttons(self, current_user, users):
        len_users = len(list(users))

        if len_users <= 0 or current_user not in users:
            return None

        prev_user = list(users).index(current_user) - 1
        next_user = list(users).index(current_user) + 1

        back = list(users)[list(users).index(current_user) - 1] \
            if int(prev_user) >= 0 and prev_user < len_users else current_user
        next = list(users)[list(users).index(current_user) + 1] \
            if next_user < len_users else current_user

        return {"next": next, "back": back}

    def get_user_data(self, current_lesson, current_username, lessons):
        user_db = list(self.database.feedbacks.find({
            "lesson_id": current_lesson,
            "username": current_username
        }))

        user_data = OrderedDict()

        user_data['avg'] = OrderedDict()
        user_data['avg']['grade'] = ''

        user_data['overall'] = OrderedDict()
        user_data['overall']['feedback'] = ''
        user_data['overall']['grade'] = ''

        for ind, task in enumerate(lessons[current_lesson]['tasks']):
            user_data[task['id']] = OrderedDict()
            user_data[task['id']]['feedback'] = ''
            user_data[task['id']]['grade'] = ''

        for user in user_db:
            if user['is_average']:
                user_data['avg'] = OrderedDict()
                user_data['avg']['grade'] = user['grade']
            elif user['is_overall']:
                user_data['overall'] = OrderedDict()
                user_data['overall']['feedback'] = user['feedback']
                user_data['overall']['grade'] = user['grade']
            else:
                user_data[user['task_id']] = OrderedDict()
                user_data[user['task_id']]['feedback'] = user['feedback']
                user_data[user['task_id']]['grade'] = user['grade']

        return user_data

    def get_user_grade_final_submission_for_lesson(self, course, current_user, current_lesson):
        user_submission = dict()
        courseid = course.get_id()
        user_task = list(self.database.user_tasks.find({"courseid": courseid, "username": current_user}))
        if user_task:
            for task in user_task:
                task_id = task['taskid']
                lesson_name, task_name = get_task_and_lesson(task_id)

                if lesson_name == current_lesson:
                    submission = self.submission_manager.get_submission(task['submissionid'], False)
                    task_object = self.task_factory.get_task(course, task_id)
                    if submission:

                        submission = self.submission_manager.get_input_from_submission(submission)
                        submission = self.submission_manager.get_feedback_from_submission(submission, show_everything=True)
                        submission = self.submission_manager.get_input_extra_data(submission, task_object, courseid, task_id)

                        user_submission[task_name] = submission

        return user_submission


class IndexPage(ManualPlugin):
    def GET_AUTH(self, courseid):
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        users = self.get_users(course)
        lessons = self.get_lessons(course)
        current_user = users[list(users)[0]]['username'] if len(list(users)) > 0 else None
        current_lesson = list(lessons)[0] if len(list(lessons)) > 0 else None
        buttons = self.get_buttons(current_user, users)
        user_submission = self.get_user_grade_final_submission_for_lesson(course, current_user, current_lesson)
        user_data = self.get_user_data(current_lesson, current_user, lessons)

        return self.template_helper.get_custom_renderer('frontend/webapp/plugins/manual')\
            .admin(course, lessons, users, current_lesson,
                   current_user, buttons, self.webterm_link, user_submission, user_data)

# /inginious/frontend/webapp/static/plugins/manual/out.pdf
class StudentPage(ManualPlugin):
    def GET_AUTH(self, courseid, lesson_id, student_id):
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        lessons = self.get_lessons(course)
        users = self.get_users(course)
        current_lesson = lesson_id
        current_user = student_id
        buttons = self.get_buttons(current_user, users)
        user_submission = self.get_user_grade_final_submission_for_lesson(course, current_user, current_lesson)
        user_data = self.get_user_data(current_lesson, current_user, lessons)

        if student_id not in users or lesson_id not in lessons:
            return web.seeother(web.ctx.homepath + '/admin/' + course.get_id() + '/manual')
        else:
            return self.template_helper.get_custom_renderer('frontend/webapp/plugins/manual') \
                .admin(course, lessons, users, current_lesson,
                       current_user, buttons, self.webterm_link, user_submission, user_data)


class SaveManual(ManualPlugin):
    def POST_AUTH(self, courseid, lessonid, evaluated_student):
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        lessons = self.get_lessons(course)
        users = self.get_users(course)
        data = json.loads(web.data().decode())

        if lessonid not in lessons:
            return json.dumps({'status': 'error'})

        if evaluated_student not in users:
            return json.dumps({'status': 'error'})

        for user in data:
            feedback = list(self.database.feedbacks.find({
                "course_id": user['course_id'],
                "lesson_id": user['lesson_id'],
                "task_id": user['task_id'],
                "is_average": user['is_average'],
                "is_overall": user['is_overall'],
                "username": evaluated_student
            }))

            if feedback:
                """ Update feedback """
                if user['grade'] != feedback[0]['grade'] or user['feedback'] != feedback[0]['feedback']:
                    self.database.feedbacks.update(
                        {
                            "_id": feedback[0]['_id']
                        },
                        {
                            "course_id": user['course_id'],
                            "lesson_id": user['lesson_id'],
                            "task_id": user['task_id'],
                            "feedback": user['feedback'],
                            "grade": user['grade'],
                            "is_average": user['is_average'],
                            "is_overall": user['is_overall'],
                            "username": evaluated_student,
                            "updated_at": datetime.now(),
                            "created_at": feedback[0]['created_at'],
                        }
                    )
            else:
                """ Create new feedback """
                if user['grade'] or user['feedback']:
                    self.database.feedbacks.insert({
                        "course_id": user['course_id'],
                        "lesson_id": user['lesson_id'],
                        "task_id": user['task_id'],
                        "feedback": user['feedback'],
                        "grade": user['grade'],
                        "is_average": user['is_average'],
                        "is_overall": user['is_overall'],
                        "username": evaluated_student,
                        "updated_at": None,
                        "created_at": datetime.now()
                    })

        return json.dumps({'status': 'success'})

class ViewPDF(ManualPlugin):
    '''
    Used by DownloadPDF to generate the pdf 
    '''
    def GET_AUTH(self, courseid, lessonid, evaluated_student):

        page = web.template.render(MANUAL_DIR_PATH)
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        lessons = self.get_lessons(course)
        data = self.get_user_data(lessonid, evaluated_student, lessons)
        user_real_name = self.user_manager.get_user_realname(evaluated_student)

        return page.pdf(user_real_name, lessonid, data)


class DownloadPDF(ManualPlugin):
    def GET_AUTH(self, courseid, lessonid, evaluated_student):

        url = 'http://' + web.ctx.host + '/admin/' + courseid + '/manual/' + lessonid + '/' + evaluated_student + '/pdf-view'
        file_name_downloaded = 'feedback_'+courseid + '_' + lessonid + '_' + evaluated_student+'.pdf'
        options = {
            'page-size': 'Legal',
            'margin-top': '0.75in',
            'margin-right': '0.75in',
            'margin-bottom': '0.75in',
            'margin-left': '0.75in',
            'encoding': 'UTF-8',
            'custom-header': [
                ('Accept-Encoding', 'gzip')
            ],
            'cookie': [
                ('webpy_session_id', web.cookies().get('webpy_session_id'))
            ],
            'no-outline': None
        }

        temp_file = tempfile.mktemp()
        # will activate the os's wkhtmltopdf (https://wkhtmltopdf.org/) and generate the pdf
        success = pdfkit.from_url(url, temp_file, options=options)
        if not success:
            raise Exception('failed to create a pdf file for ' + evaluated_student)

        '''
        todo, this could be dangerous, sending a file without file.close().
        could cause a memory leak
        '''
        pdf_file = open(temp_file, 'rb')
        web.header('Content-Type','application/pdf', unique=True)
        web.header('Content-Disposition', 'attachment; filename="'+file_name_downloaded+'"', unique=True)

        return pdf_file


def add_admin_menu(course):
    """ Add matrix setting to the admin panel """
    return ('manual', '<i class="fa fa-list-ol fa-fw"></i>&nbsp; Manual Feedback')


def add_css_file():
    """ Add matrix css file to the admin page """
    return web.ctx.homepath + '/static/webapp/plugins/manual/manual.css'


def add_js_file():
    """ Add matrix css file to the admin page """
    return web.ctx.homepath + '/static/webapp/plugins/manual/manual.js'


def init(plugin_manager, _, _2, _3):
    plugin_manager.add_hook("course_admin_menu", add_admin_menu)
    plugin_manager.add_hook('course_admin_main_menu', add_admin_menu)
    plugin_manager.add_hook('javascript_header', add_js_file)
    plugin_manager.add_hook('css', add_css_file)
    plugin_manager.add_page("/admin/([^/]+)/manual", IndexPage)
    plugin_manager.add_page("/admin/([^/]+)/manual/([^/]+)/([^/]+)", StudentPage)
    plugin_manager.add_page("/admin/([^/]+)/task-manual/([^/]+)", OriginalTaskPage)
    plugin_manager.add_page("/admin/([^/]+)/task-manual/([^/]+)/save-manual/([^/]+)", SaveManual)
    plugin_manager.add_page("/admin/([^/]+)/manual/([^/]+)/([^/]+)/pdf-view", ViewPDF)
    plugin_manager.add_page("/admin/([^/]+)/manual/([^/]+)/([^/]+)/pdf-export", DownloadPDF)


