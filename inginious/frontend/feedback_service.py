import locale
import logging
import traceback

import inginious
import codecs


def get_feedback_file_name(task_type):
    if task_type == 'python-unit-test':
        return 'feedback_python.html'
    if task_type == 'cpp-test':
        return 'feedback_cpp.html'

    return 'feedback.html'


def add_feedback_html_to_user_input(user_input, task_id, task_type):
    try:

        # couldn't open with  get_renderer, errors on js, tries to render the page and run the js
        feedback_file_name = get_feedback_file_name(task_type)
        file_path = inginious.get_root_path() + '/frontend/templates/task_page/' + feedback_file_name
        with codecs.open(file_path, 'r', encoding='utf8') as f:
            feedback_html = f.read()
        # todo, in order to support multiple scenario boxes in the same html page,
        # it might be a good idea to render the html with the task id in it (05-06, for example)
        # that way, the way the js will render in the appropriate modal
        feedback_html_injected_with_id = feedback_html.replace('task_id_to_replace', task_id)
        feedback_html_injected_with_id = '.. raw:: html' + '\n' + indent(feedback_html_injected_with_id, 4)
        user_input['html_template'] = feedback_html_injected_with_id
    except Exception:
        preferred_encoding = locale.getpreferredencoding()
        logging.error(' ---- preferred_encoding ' + repr(preferred_encoding))
        # text = 'error template_helper --- ' + repr(err)
        # self.logger.error(text)
        logging.error('traceback data is ' + traceback.format_exc())
        user_input['html_template'] = ''

    return user_input


def indent(text, amount, ch=' '):
    padding = amount * ch
    return ''.join(padding + line for line in text.splitlines(True))