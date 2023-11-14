from collections import OrderedDict
from inginious.frontend.pages.course_admin.utils import INGIniousAdminPage
from inginious.frontend.accessible_time import AccessibleTime
import json
import datetime as dt
import os
import re
import flask

MANUAL_DIR_PATH = os.path.dirname(os.path.abspath(__file__))

class BulkDateChangePage(INGIniousAdminPage):
    """ Bulk Dadeline change """
    def GET_AUTH(self, courseid):
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        lessons = self._get_lessons(course)
        current_lesson = list(lessons)[0] if len(list(lessons)) > 0 else None
        tasks = self._get_tasks(course)
        min_date = dt.date.today().strftime('%Y-%m-%d %H:%M:%S')
        max_date = dt.datetime.combine (dt.date.today() + dt.timedelta(days=6), dt.time(23, 59, 59))
        max_date = max_date.strftime('%Y-%m-%d %H:%M:%S')

        # return self.template_helper.get_custom_renderer('frontend/plugins/bulk_date_change')\
        #     .admin(course, lessons, current_lesson, self.webterm_link, AccessibleTime, tasks, min_date, max_date)
        return self.template_helper.render("admin.html", 
                                    template_folder='frontend/plugins/bulk_date_change',
                                    course=course, 
                                    lessons=lessons,
                                    min_date=min_date,
                                    max_date=max_date,
                                    current_lesson=current_lesson)

    def POST_AUTH(self, courseid):
        course = self.get_course_and_check_rights(courseid, allow_all_staff=True)[0]
        data = json.loads(list(flask.request.form.to_dict().keys())[0])
        tasks = self._get_tasks(course)

        filtered_tasks = self._get_lesson_tasks(course, data['selected_lesson'])
        for task_id in filtered_tasks:
            try:
                task_data = self.task_factory.get_task_descriptor_content(courseid, task_id)
            except:
                task_data = None
            if task_data is None:
                task_data = {}

            if data['accessible']=='custom':
                task_data["accessible"] = "{}/{}".format(data["accessible_start"], data["accessible_end"])
            elif data['accessible']=='always':
                task_data["accessible"] = True
            elif data['accessible']=='never':
                task_data["accessible"] = False

            self.task_factory.update_task_descriptor_content(courseid, task_id, task_data, None)

        return json.dumps({'status': 'success'})

    """ Get all lessons """
    def _get_lessons(self, course):
        tasks = course.get_tasks()
        lessons_list = set()
        lessons = []

        for task in tasks:
            lessons_list.add(self._get_task_and_lesson(task)[0])

        if lessons_list:
            # sorted_lessons = sorted(lessons_list, key=int)
            sorted_lessons = sorted(lessons_list)
            lessons = OrderedDict([(lesson, {"name": lesson,
                                             "tasks": []}) for lesson in sorted_lessons])
        for task in tasks:
            lesson_num, task_num = self._get_task_and_lesson(task)

            lessons[lesson_num]['tasks'].append({"id": task_num,
                                                 "taskid": tasks[task]})

        return lessons

    def _get_tasks(self, course):
        # Get Tasks
        files = self.task_factory.get_readable_tasks(course)
        output = {}
        errors = []
        for task in files:
            try:
                output[task] = course.get_task(task)
            except Exception as inst:
                errors.append({"taskid": task, "error": str(inst)})
        # return OrderedDict(sorted(list(output.items()), key=lambda t: (t[1].get_order(), t[1].get_id())))
        return OrderedDict(sorted(list(output.items())))

    def _get_lesson_tasks(self, course, lesson):
        tasks = self._get_tasks(course)
        output = {}
        pattern = re.compile("^" + lesson)

        for task in tasks:
            if pattern.match(task):
                output[task] = course.get_task(task)
        return output

    # according to a naming convention lesson-task
    def _get_task_and_lesson(self, task_name):
        task_splitted = task_name.split('-')
        lesson_name = task_splitted[0]
        task_name = task_splitted[len(task_splitted) - 1]

        return lesson_name, task_name


def add_admin_menu(course):
    """ Add date change setting to the admin panel """
    return ('bulk_date_change', '<i class="fa fa-clock-o fa-fw"></i>&nbsp; Bulk Deadline Change')


def add_course_menu(course, template_helper):
    html = f'''
        <div class="list-group">
            <a class="list-group-item list-group-item-action list-group-item-info" href="{flask.request.url_root}/admin/{course.get_id()}/bulk_date_change">
            <i class="fa fa-clock-o fa-fw"></i>&nbsp; Bulk Deadline Change
            </a>
        </div>
    '''
    return html

def add_css_file():
    """ Add date change css file to the admin page """
    return '/static/plugins/bulk_date_change/bulk_date_change.css'


def add_js_file():
    """ Add date change css file to the admin page """
    return '/static/plugins/bulk_date_change/bulk_date_change.js'


def init(plugin_manager, _, _2, _3):
    plugin_manager.add_hook('course_menu', add_course_menu)
    plugin_manager.add_hook("course_admin_menu", add_admin_menu)
    plugin_manager.add_hook('course_admin_main_menu', add_admin_menu)
    plugin_manager.add_hook('javascript_header', add_js_file)
    plugin_manager.add_hook('css', add_css_file)
    plugin_manager.add_page("/admin/<courseid>/bulk_date_change", BulkDateChangePage.as_view('bulk_date_change'))
