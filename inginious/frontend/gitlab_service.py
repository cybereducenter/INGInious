import base64
import json
import logging
import os
from datetime import datetime

import gitlab

GITLAB_TOKEN = os.environ.get('GITLAB_TOKEN', "glpat-YKP9Ln5ioCH7GRG-GRu8")
GITLAB_GROUP = os.environ.get('GITLAB_GROUP', 'ExerciseTests')
GITLAB_PROJECT = os.environ.get('GITLAP_PROJECT', 'SubmissionVerifierFiles')
GITLAB_FILE = os.environ.get('GITLAP_FILE', 'EkronotTraining2023_71758711_2023.json')

logger = logging.getLogger("inginious.frontend.gitlab_service")


def update_gitlab_json(new_dates, courseid, taskid=None):
    if type(new_dates) != bool:
        dates = [str(datetime.strptime(x, '%Y-%m-%d %H:%M:%S').date()) if x else x for x in new_dates]
    elif new_dates:
        dates = [str(datetime.now().date()), None]
    else:
        dates = [None, None]

    try:
        gitlab_client = gitlab.Gitlab(private_token=GITLAB_TOKEN)
        project = gitlab_client.projects.get(gitlab_client.groups.get(GITLAB_GROUP)
                                             .projects.list(search=GITLAB_PROJECT)[0].id)
        file = project.files.get(GITLAB_FILE, 'main')
        content = base64.b64decode(file.content).decode('utf-8')
        content_dict = json.loads(content)
        if courseid not in content_dict:
            content_dict[courseid] = {}
        if taskid and taskid not in content_dict[courseid]:
            content_dict[courseid][taskid] = {}
        if taskid:
            content_dict[courseid][taskid]['startFrom'] = dates[0]
            content_dict[courseid][taskid]['dueTo'] = dates[1]
        else:
            content_dict[courseid]['startFrom'] = dates[0]
            content_dict[courseid]['dueTo'] = dates[1]
        file.content = json.dumps(content_dict, indent=4)
        file.save(branch='main',
                  commit_message=f"change start/end dates for course {courseid}" + (f" for task {taskid}" if taskid else ""))
        logger.error(
            f"Updated GitLab accessibility dates for course {courseid}" + (f" for task {taskid}" if taskid else ""))
    except Exception as e:
        logger.error(
            f"Failed to update GitLab accessibility dates for course {courseid}" +
            (f" for task {taskid}" if taskid else "" + f": {e}"))
