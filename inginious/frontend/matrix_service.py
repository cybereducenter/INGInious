from collections import OrderedDict


def get_course_students(course, user_manager):
    users = sorted(list(
        user_manager.get_users_info(user_manager.get_course_registered_users(course, False)).items()),
        key=lambda k: k[1][0] if k[1] is not None else "")

    users = OrderedDict([(user[0], {"username": user[0],
                                    "realname": user[1][0] if user[1] is not None else None}) for user in users])
    return users
