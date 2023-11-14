/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var BulkDateChangePlugin = (function() {
    var isSaved = false;
    var $ = jQuery;
    var alertID = 'alert-manual-feedback';
    var secondsDelayToDissolveAlert = 3;
    /**
     * On save btn
     * @param courseId
     * @param lessonId
     */
    function onClickSave(courseId, lessonId) {
        var saveBtn =  $('.submit-btn');
        var selected_lesson = $('#list').change(function() {
            return $(":selected").attr('value');
        });
        var accessible_start = $('#accessible_start').change(function() {
            return $(":selected").attr('value');
        });
        var accessible_end = $('#accessible_end').change(function() {
            return $(":selected").attr('value');
        });

        var accessible = $("input[name='accessible']").change(function() {
            return($(this).attr('value'));
        })

        saveBtn.on('click', function () {
            _sendTasks (courseId, selected_lesson, accessible_start, accessible_end, accessible)
        });


    }


    /**
     * Change date for all lesson
     * @param courseId
     * @param selected_lessson
     * @param accessible_start
     * @param accessible_end

     */
    var _sendTasks = function(courseId, selected_lesson, accessible_start, accessible_end, accessible) {
        var url = '/admin/' + courseId + '/bulk_date_change';

        var data = {};

        data['selected_lesson'] = selected_lesson.val();
        data['accessible_start'] = accessible_start.val();
        data['accessible_end'] = accessible_end.val();
        data['accessible'] = accessible.filter(":checked").val();

        $.ajax({
            url: url,
            method: "POST",
            data: JSON.stringify(data),
            dataType: 'json',
            success: function(data) {
                if (data.status == 'success') {
                    _manualAlertMessage("Deadline changed", 'success');
                } else {
                    _manualAlertMessage("Deadline change failed!", 'danger');
                }
            },
            error: function(data) {
                _manualAlertMessage('An internal error occurred. Please retry later. If the error persists, send an email to the course administrator.', 'danger')
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

    return {
        onClickSave: onClickSave,
    }
})(jQuery);
