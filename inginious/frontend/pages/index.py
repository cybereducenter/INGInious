# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Index page """
from flask import redirect, url_for
from inginious.frontend.pages.utils import INGIniousAuthPage


class IndexPage(INGIniousAuthPage):
    """ Index page """

    def GET_AUTH(self):  # pylint: disable=arguments-differ
        return redirect("/mycourses")
        

    def POST_AUTH(self):  # pylint: disable=arguments-differ
        return redirect("/mycourses")
        