/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var MatrixPlugin = (function () {

    //    var isSaved = false;
    //    var $ = jQuery;
    //    var alertID = 'alert-manual-feedback';
    //    var secondsDelayToDissolveAlert = 3;

    /**
     * On save btn
     * @param courseId
     * @param lessonId
     */
    //    function onHover() {
    //        $('.graded').hover(
    //            function() {
    //            console.log("hello")
    //            }
    //        );
    //
    //
    //    }

    function onHover(data_users) {
        $('.graded_icon').each(function () {
            $(this).qtip({
                content: {
                    text: $(this).next('.tooltiptext')
                },
                style: {
                    classes: 'qtip-bootstrap',
                    width: 250
                }
            })
        })
        $('.feedback_link').each(function () {
            $(this).qtip({
                content: {
                    text: $(this).next('.feedbacktext')
                },
                style: {
                    classes: 'qtip-bootstrap',
                    width: 250
                }
            })
        })
    }

    //function onHover(data_users) {
    //    $('.graded').each(function() {
    //        $(this).qtip({
    //            content: {
    //                text: 'Last Submission: ' + getTimePassed(this.id)
    //            },
    //              style: {
    //                  classes: 'qtip-bootstrap',
    //                  width: 250
    //              }
    //              })
    //    })
    //}

    function getTimePassed(submissionid) {

        //newJson2 = JSON.parse(newJson);
        var newJson = submissionid.replace(/\'/g, '"');
        newJson = JSON.parse(newJson);
        return (newJson["time_passed"]);
    }

    function final_submission(event) {
        const user_len = parseInt(event.value);
        const lesson = $('#select_lesson')[0].value;
        var students = [];
        const selectElement = $('#select_students')[0];
        for (var i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].selected) {
                students.push(selectElement.options[i].value);
            }
        }

        var href = window.location.href.split("/");
        href[href.length - 1] = lesson;
        href = href.join('/');

        var message = "";
        $.ajax({
                type: "POST",
                url: href + "/merge_feedback",
                contentType: 'application/json',
                data: JSON.stringify(students.length !== user_len ? {
                    "student": students,
                } : {}),
                success: function(response) {
                    console.log("success");
                    if (response) {
                        console.log(response)
                    }
                    message = "Lesson" + lesson + " was submitted for students: " + students;
                    studio_display_feedback_submit_message(message, "", "success", true);
                },
                error: function (e) {
                    console.log("error: " + e)
                    message = "An internal error occurred";
                    studio_display_feedback_submit_message("Some error(s) occurred during submission: " + message, "", "danger", true);
                },
            });

    }

    function studio_display_feedback_submit_message(title, content, type, dismissible)
    {
        var code = getAlertCode(title, content, type, dismissible);
        $('#feedback_submit_status').html(code);
        window.scrollTo(0,0);
        if(dismissible)
        {
            window.setTimeout(function()
            {
                $("#feedback_submit_status").children().fadeTo(1000, 0).slideUp(1000, function()
                {
                    $(this).remove();
                });
            }, 3000);
        }
    }

    return {
        onHover: onHover,
        final_submission: final_submission,
    }
})(jQuery);


