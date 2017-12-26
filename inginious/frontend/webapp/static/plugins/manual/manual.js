/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var ManualPlugin = (function() {
    var isSaved = false;
    var $ = jQuery;
    var alertID = 'alert-manual-feedback';
    var secondsDelayToDissolveAlert = 3;
    /**
     * On save btn
     * @param courseId
     * @param lessonId
     * @param current_user
     */
    function onClickSave(courseId, lessonId, current_user) {
        var saveBtn =  $('.save-btn');

        saveBtn.on('click', function () {
            _sendTasks(courseId, lessonId, current_user);
        });
    }

    /**
     * On export button
     * @param courseId
     * @param lessonId
     * @param evaluatedStudent
     */
    function onClickExport(courseId, lessonId, evaluatedStudent) {
        var exportBtn =  $('.export-btn');

        exportBtn.on('click', function () {
            _exportToPdf(courseId, lessonId, evaluatedStudent);
        });

    }

    /**
     * On export and Next button
     * @param courseId
     * @param lessonId
     * @param evaluatedStudent
     */
    function onClickExportAndNext(courseId, lessonId, evaluatedStudent) {
        var exportNextBtn =  $('.export-next-btn');

        exportNextBtn.on('click', function () {
            var urlOfNextStudent, isEndOfStudents = $('.btn-arrow.btn-right').hasClass('btn-disabled');
            _exportToPdf(courseId, lessonId, evaluatedStudent);
            if (isEndOfStudents){
                alert('You have reached the end')
            }else{
                urlOfNextStudent = $('.btn-arrow.btn-right').attr('href');
                window.location.href = urlOfNextStudent
            }


        });
    }


    var _exportToPdf = function (courseId, lessonId, evaluatedStudent) {
        _sendTasks(courseId, lessonId, evaluatedStudent);
        var url = '/admin/' + courseId + '/manual/' + lessonId + '/' + evaluatedStudent + '/pdf-export';
        try {
            var child = window.open(url); child.focus();
        } catch (e) {
            console.log(e)
        }
        
    };

    /**
     * Add or update task grade and feedback
     * @param courseId
     * @param lessonId
     * @param current_user - is the student currently being evaluated 
     */
    var _sendTasks = function(courseId, lessonId, current_user) {
        var url = '/admin/' + courseId + '/task-manual/' + lessonId + '/save-manual/' + current_user;
        var tasksId = $('.overall-grade').find('th');
        var tasks = $('.task');
        var overallFeedbackInput = $('.overall-feedback textarea');
        var overallGradeInput = $('.overall-grade-input');
        var avgGrade = $('.avg-grade');
        var tasksIdArr = [];
        var tasksArr = [];
        var overall = {};
        var avg = {};


        overall['task_id'] = '';
        overall['lesson_id'] = lessonId;
        overall['course_id'] = courseId;
        overall['feedback'] = overallFeedbackInput.val();
        overall['grade'] = overallGradeInput.val();
        overall['is_overall'] = true;
        overall['is_average'] = false;

        tasksArr.push(overall);

        avg['task_id'] = '';
        avg['lesson_id'] = lessonId;
        avg['course_id'] = courseId;
        avg['feedback'] = '';
        avg['grade'] = avgGrade.html().trim();
        avg['is_overall'] = false;
        avg['is_average'] = true;

        tasksArr.push(avg);

        for (var j = 2; j < tasksId.length; j++) {
            var taskId = $(tasksId[j]);

            tasksIdArr.push(taskId.html().trim());
        }

        for (var i = 0; i < tasks.length; i++) {
            var taskObj = {};
            var task = $(tasks[i]);
            var feedback = task.find('.feedback');
            var grade = task.find('.grade');

            taskObj['task_id'] = tasksIdArr[i];
            taskObj['lesson_id'] = lessonId;
            taskObj['course_id'] = courseId;
            taskObj['feedback'] = feedback.val();
            taskObj['grade'] = grade.val();
            taskObj['is_overall'] = false;
            taskObj['is_average'] = false;

            tasksArr.push(taskObj);
        }

        $.ajax({
            url: url,
            method: "POST",
            data: JSON.stringify(tasksArr),
            dataType: 'json',
            success: function(data) {
                if (data.status == 'success') {
                    _manualAlertMessage("Your feedback saved!", 'success');
                    isSaved = true;
                } else {
                    _manualAlertMessage("Your feedback failed!", 'danger');
                }
            },
            error: function(data) {
                _manualAlertMessage('An internal error occured. Please retry later. If the error persists, send an email to the course administrator.', 'danger')
            }
        });
    };

    var _manualAlertMessage = function(message, type) {
        var manualTitle = $('.manual-title');
        var alertIDForDiv='#'+alertID;
        var alert = $('<div id="'+alertID+'"></div>');
        var closeBtn = $("<button></button>");

        closeBtn.addClass("close");
        closeBtn.attr("type", "button").attr("data-dismiss", "alert").attr("aria-hidden", "true").attr("aria-label", "Close");
        closeBtn.html("&times;");

        alert.addClass('alert' + ' alert-' + type);
        alert.attr('role', 'alert');

        alert.append(closeBtn);
        alert.append(message);

        if (!$('.alert').length) {
            manualTitle.after(alert);
        }

        $(alertIDForDiv).fadeTo(secondsDelayToDissolveAlert*1000, 500).slideUp(500, function(){
            $(alertIDForDiv).slideUp(500);
        });
    };


    /**
     * On submit all btn
     */
    var onSubmitAllBtn = function() {
        var submitAllBtn = $('.submit-all');
        var tasks = $('form')
        submitAllBtn.on('click', function(event) {
            event.preventDefault();
            $.each(tasks, function(index, value){
               var taskChildren = $(value).children()
                if(taskChildren.length > 2){
                    $(value).submit();
                }
            })
        });
    };


    /**
     * On click arrow btn
     */
    var onClickArrowBtn =function() {
        $('.btn-arrow').on('click', function(event) {
            var target = $(event.target);
            var btnArrow = target.closest('.btn-arrow');

            btnArrow.addClass('btn-disabled');
        });
    };


    /**
     * On change overall grade
     */
    var onChangeOverallGrade = function() {
        var gradeInput = $('.overall-grade-input');
        var newGrade = '';

        gradeInput.on('keyup change click', function () {
            if (!_isGradeValid(gradeInput.val())) {
                if (gradeInput.val().toString().substring(0, 3) == 100) {
                    newGrade = gradeInput.val().toString().substring(0, 3);
                } else {
                    newGrade = gradeInput.val().toString().substring(0, 2);
                }

                gradeInput.val(newGrade);
            }
        });
    };


    /**
     * On close window
     */
    var onCloseWindow =function(feedbacksOriginArr) {
        $(window).on("beforeunload", function(event) {
            var feedbacks = $('.feedback');

            if (isSaved) {
                return;
            }

            for (var i = 0; i < feedbacks.length; i++) {
              if (feedbacks[i].value != feedbacksOriginArr[i]) {
                  return '';
              }
            }
        });
    };


    /**
     * Get the default feedback value
     * @returns {Array}
     */
    var getDefaultFeedbacksValue = function() {
        var feedbacksOrigin = $('.feedback');
        var feedbacksOriginArr = [];

        for (var i = 0; i < feedbacksOrigin.length; i++) {
          feedbacksOriginArr.push(feedbacksOrigin[i].value);
        }

        return feedbacksOriginArr;
    };


    /**
     * Init manual task
     * @param taskId
     * @param lessonId
     * @param courseId
     */
    var initManualTask = function(taskId) {
        var task = $('.task-' + taskId);
        var taskNumber = $('#task-submit-'  + taskId);
        var form = taskNumber.closest('form');

        form.on('submit', function(event) {
            event.preventDefault();
            var textareaInput = $($(this).find(".code-editor")).val();
            var url = $(this).attr('action');


            if (!manualTaskValidation(task)) {
                return;
            }

            $.ajax({
                url: url,
                method: "POST",
                data: { "program": textareaInput, "@action": "submit" },
                dataType: 'json',
                success: function(data) {
                    if ("status" in data && data["status"] == "ok" && "submissionid" in data) {
                        manualWaitForSubmission(data['submissionid'], task);
                    }
                },
                error: function(msg) {
                    manualDisplayErrorAlert(task);
                }
            });
        });

        _onToTopBtn();
        _onToFeedback(task);
        _onChangeGrade(task, taskId);
    };


    /**
     * Wait for submission
     * @param submissionId
     * @param task
     */
    function manualWaitForSubmission(submissionId, task) {
        var url = task.find('form').attr('action');

        setTimeout(function() {
            $.ajax({
                url: url,
                method: "POST",
                data: { "@action": "check", "submissionid": submissionId },
                dataType: 'json',
                success: function(data) {
                    // the div to display the alerts
                    window.specificTaskId = task.find('.task-submit-alert');
                    
                    if ("status" in data && data['status'] == "waiting") {
                        manualWaitForSubmission(submissionId, task);
                        manualGetLoadingAlert(task);
                    } else if("status" in data && "result" in data && "grade" in data) {
                        if (data['result'] == "failed") {
                            displayTaskStudentErrorAlert(data)
                        } else if (data['result'] == "success") {
                            displayTaskStudentSuccessAlert(data)
                        } else if (data['result'] == "timeout") {
                            displayTimeOutAlert(data);
                        } else if (data['result'] == "overflow") {
                            displayOverflowAlert(data);
                        } else if (data['result'] == "killed") {
                            displayKilledAlert(data);
                        } else { // error
                            displayTaskErrorAlert(data);
                        }
                    } else {
                        displayTaskErrorAlert(data);
                    }
                },
                error: function(data) {
                    displayTaskErrorAlert(task);
                }
            });
        }, 1000);
    }


    /**
     * Check if the form is valid or not
     * @param form
     * @returns {boolean}
     */
    function manualTaskValidation(task) {
        var form = task.find('form');
        var textareaInput = form.find(".code-editor");

        // Check if textarea is empty or not
        if (!textareaInput.val()) {
            var span = $('<span></span>');
            span.html('Please answer to all the questions.');
            var taskAlert = manualGetAlertCode(span, 'danger');

            task.find('#task_alert').html(taskAlert);

            return false;
        } else {
            return true;
        }
    }


    /**
     * Get alert code
     * @param content
     * @param type
     * @returns {*|jQuery|HTMLElement}
     */
    function manualGetAlertCode(content, type) {
        var taskAlert = $('<div></div>');
        taskAlert.attr('id', 'task_alert');

        var alert = $('<div></div>');
        alert.addClass('alert fade in alert-' + type);
        alert.attr('role', 'alert');
        alert.appendTo(taskAlert);

        content.appendTo(alert);

        return taskAlert;
    }


    /**
     * Get loading alert
     * @param task
     */
    function manualGetLoadingAlert(task) {
        var form = task.find('form');
        var content = '<i class="fa fa-spinner fa-pulse fa-fw" aria-hidden="true"></i>';
        content += "<b>Your submission has been sent...</b>";

        var loadingAlert = $('<div></div>');
        loadingAlert.addClass('loading-alert');
        loadingAlert.html(content);

        var taskAlert = manualGetAlertCode(loadingAlert, 'info');

        task.find('#task_alert').html(taskAlert);
    }


    /**
     * Display failed alert
     * @param task
     * @param taskData
     */
    // function manualDisplayFailedAlert(task, taskData) {
    //     var div = $('<div></div>');
    //
    //     var b = $('<b></b>');
    //     b.html('There are some errors in your answer. Your score is ' + taskData.grade + '<br>');
    //     b.appendTo(div);
    //
    //     var pre = $(taskData.text);
    //     pre.appendTo(div);
    //
    //     var taskAlert = manualGetAlertCode(div, 'danger');
    //
    //     task.find('#task_alert').html(taskAlert);
    // }


    /**
     * Display success alert
     * @param task
     * @param taskData
     */
    // function manualDisplaySuccessAlert(task, taskData) {
    //     var div = $('<div></div>');
    //     var content = '';
    //     content += 'Your answer passed the tests! Your score is ' + taskData.grade;
    //     content += taskData.text;
    //     div.html(content);
    //
    //     var taskAlert = manualGetAlertCode(div, 'success');
    //
    //     task.find('#task_alert').html(taskAlert);
    // }


    /**
     * Display kill alert
     * @param task
     */
    // function manualDisplayKillAlert(task) {
    //     var b = $('<b></b>');
    //     b.html('Your submission was killed.');
    //
    //     var taskAlert = manualGetAlertCode(b, 'warning');
    //
    //     task.find('#task_alert').html(taskAlert);
    // }


    /**
     * Display error alert
     * @param task
     */
    function manualDisplayErrorAlert(task) {
        var b = $('<b></b>');
        b.html('An internal error occured. Please retry later. If the error persists, send an email to the course administrator.');

        var taskAlert = manualGetAlertCode(b, 'danger');

        task.find('#task_alert').html(taskAlert);
    }


    /**
     * Display timeout alert
     * @param task
     * @param taskData
     */
    // function manualDisplayTimeoutAlert(task) {
    //     var b = $('<b></b>');
    //     b.html('Your submission timed out');
    //
    //     var taskAlert = manualGetAlertCode(b, 'warning');
    //
    //     task.find('#task_alert').html(taskAlert);
    // }


    /**
     * Display overflow alert
     * @param task
     * @param taskData
     */
    // function manualDisplayOverflowAlert(task) {
    //     var b = $('<b></b>');
    //     b.html('Your submission made an overflow');
    //
    //     var taskAlert = manualGetAlertCode(b, 'warning');
    //
    //     task.find('#task_alert').html(taskAlert);
    // }


    /**
     * On click to top btn
     */
    var _onToTopBtn = function() {
        var body = $('html, body');
        var toTopBtn = $('.to-top');

        toTopBtn.on('click', function(event) {
            event.preventDefault();
            body.stop().animate({ scrollTop: 0 }, '500', 'swing');
        });
    };


    /**
     * On click to feedback btn
     * @param task
     */
    var _onToFeedback = function(task) {
        var body = $('html, body');
        var toFeedbackBtn = task.find('.to-feedback');

        toFeedbackBtn.on('click', function() {
            event.preventDefault();
            $(body).stop().animate({ scrollTop: task.offset().top }, '500', 'swing');
            task.find('.feedback').focus();
        });
    };


    /**
     * Check changes on grade
     * @param task
     * @param taskId
     */
    var _onChangeGrade = function(task, taskId) {
        var gradeInput = task.find('.grade');
        var grade = $('.grade-' + taskId);
        var newGrade = '';

        gradeInput.on('keyup change click', function () {
            if (_isGradeValid(gradeInput.val())) {
                grade.html(gradeInput.val());
                _checkAvgGrade();
            } else {
                if (gradeInput.val().toString().substring(0, 3) == 100) {
                    newGrade = gradeInput.val().toString().substring(0, 3);
                } else {
                    newGrade = gradeInput.val().toString().substring(0, 2);
                }

                gradeInput.val(newGrade);
            }
        });
    };


    /**
     * Check if the grade is valid or not
     * @param grade
     * @returns {boolean}
     */
    var _isGradeValid = function(grade) {
        return grade >= 0 && grade <= 100;
    };


    /**
     * Check the avg grade and update the table
     */
    var _checkAvgGrade = function() {
        var avgGradeDiv = $('.avg-grade');
        var gradesLength = $('.overall-grade').find('td').length;
        var grades = [];
        var grade;
        var avgGrade = 0;

        for (var i = 0; i < gradesLength - 2 ; i++) {
            grade = $($('.overall-grade').find('td')[i + 2]);

            if (grade.html().trim() != '') {
                grades.push(grade.html().trim());
            }
        }

        for (var j = 0; j < grades.length; j++) {
            avgGrade += parseInt(grades[j]);
        }

        avgGrade = Math.round(avgGrade / grades.length);

        avgGradeDiv.html(avgGrade);
    };


    return {
        onClickSave: onClickSave,
        onSubmitAllBtn: onSubmitAllBtn,
        onClickExport: onClickExport,
        onClickExportAndNext: onClickExportAndNext,
        onCloseWindow: onCloseWindow,
        getDefaultFeedbacksValue: getDefaultFeedbacksValue,
        onClickArrowBtn: onClickArrowBtn,
        onChangeOverallGrade: onChangeOverallGrade,
        initManualTask: initManualTask
    }
})(jQuery);
