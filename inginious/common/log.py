# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Some common functions for logging """
import logging
import inginious
import os
from logging.handlers import RotatingFileHandler

def init_logging(log_level=logging.DEBUG):
    """
    Init logging
    :param log_level: An integer representing the log level or a string representing one
    """
    ##TODO before deploying this to your production!!!!!
    ## make sure write permissions
    ## cd inginious home page - for example cd /lib/python3.5/site-packages/inginious/
    ## sudo mkdir log
    ## sudo chmod -R 777 log/
    root_path = inginious.get_root_path()
    log_file_path = os.path.join(root_path, 'log', 'inginious.log')
    fmt = "%(asctime)s - PID %(process)s - TID %(thread)d - %(name)s - %(levelname)s - %(filename)s:%(lineno)s - %(message)s"
    ten_mb_in_bytes = 100 * 1000 * 1000    # some how 10Milion is 1
    logging.basicConfig(format= fmt, handlers=[RotatingFileHandler(log_file_path, encoding='utf-8', maxBytes=ten_mb_in_bytes, backupCount=10)], level=logging.INFO)


    logger = logging.getLogger("inginious")
    logger.setLevel(log_level)
    ch = logging.StreamHandler()
    ch.setLevel(log_level)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    ch.setFormatter(formatter)
    logger.addHandler(ch)

def get_course_logger(coursename):
    """
    :param coursename: the course id
    :return: a logger object associated to a specific course
    """
    return logging.getLogger("inginious.course."+coursename)


class CustomLogMiddleware:
    """ WSGI middleware for logging the status in webpy"""

    def __init__(self, app, logger):
        import web
        self.debug_web = web.debug
        self.app = app
        self.logger = logger
        self.format = '%s - - [%s] "%s %s %s" - %s'
        self._web_debug = web.debug

    def __call__(self, environ, start_response):
        def xstart_response(status, response_headers, *args):
            out = start_response(status, response_headers, *args)
            self.log(status, environ)
            return out

        return self.app(environ, xstart_response)

    def log(self, status, environ):
        req = environ.get('PATH_INFO', '_')
        protocol = environ.get('ACTUAL_SERVER_PROTOCOL', '-')
        method = environ.get('REQUEST_METHOD', '-')
        host = "%s:%s" % (environ.get('REMOTE_ADDR', '-'),
                          environ.get('REMOTE_PORT', '-'))
        msg = '%s - "%s %s %s" - %s' % (host, protocol, method, req, status)
        self.logger.info(msg)
