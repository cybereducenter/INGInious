/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var MatrixPlugin = (function() {

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
    $('.graded_icon').each(function() {
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

function getTimePassed (submissionid) {

    //newJson2 = JSON.parse(newJson);
    var newJson = submissionid.replace(/\'/g, '"');
    newJson = JSON.parse(newJson);
    return(newJson["time_passed"]);
}



    return {
        onHover: onHover,
    }
})(jQuery);



