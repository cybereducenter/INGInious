# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Tasks' constants. To avoid hard coded values """


class TaskConstants(object):


    STATUS = 'status'
    COLOR = 'color_class'
    MAX_VALUE = 'max_value'
    DEFAULT_STATUS = 'notviewed'
    ''' each item is a dict in case we'll want meta data for each item '''
    ORDERED_GRADE_COLORS_RANGE = [
        {MAX_VALUE: 0.0},
        {MAX_VALUE: 20.0},
        {MAX_VALUE: 40.0},
        {MAX_VALUE: 50.0},
        {MAX_VALUE: 60.0},
        {MAX_VALUE: 70.0},
        {MAX_VALUE: 80.0},
        {MAX_VALUE: 90.0},
        {MAX_VALUE: 100.0},
    ]
