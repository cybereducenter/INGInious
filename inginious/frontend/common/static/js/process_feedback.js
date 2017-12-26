// font awesome icons for terminal feedback (in modal popup)
var COMMENTS_IMAGES = {
    output: "fa-desktop",
    input: "fa-keyboard-o",
    false_: "fa-times-circle-o",
};


function fillModalTerminalBoxes(feedbackData, scenarioId) {
    var scenarioIdStr = '-' + scenarioId;
    var comments = [];
    console.log('scenarioIdStr is ' + scenarioIdStr);


    if (feedbackData.args) {
        // The modal's Terminal initialization
        var command_line = "C:\\Magshimim> program.exe";
        for (var i = 0; i < feedbackData.args.length; i++) {
            command_line += " " + feedbackData.args[i];
        }
    }
    $("#scenario_log" + scenarioIdStr).append('<li>' + command_line + '<li>');
    if (feedbackData.log) {
        for (var i = 0; i < feedbackData.log.quotes.length; i++) {
            var line = $('<li></li>');
            line.text(feedbackData.log.quotes[i].value);
            // todo, return this if
            if (feedbackData.log.quotes[i].type.en == "input" || feedbackData.log.quotes[i].type.en == "output") {
                line.addClass("commentable-section");
                line.attr("data-section-id", i.toString());

                comments.push({
                    "sectionId": i.toString(),
                    "comments": [
                        {
                            "id": i.toString(),
                            "authorAvatarUrl": COMMENTS_IMAGES[feedbackData.log.quotes[i].type.en],
                            "authorName": feedbackData.log.quotes[i].type.he,
                            "comment": feedbackData.log.quotes[i].name
                        }
                    ]
                });
            }
            $("#scenario_log" + scenarioIdStr).append(line);
        }
    }


    var currentUser = {
        "id": 4,
        "avatarUrl": "support/images/user.png",
        "authorUrl": "http://google.com/",
        "name": "You"
    };


    var SideComments = require('side-comments');
    window.sideComments = new SideComments('#commentable-container' + scenarioIdStr, currentUser, comments);
}


function renderScenarioRows(feedbackData, taskId){
    var scenario_row,
        modal;
    console.log('here is feedbackData. ');
    console.log(feedbackData);

    $.each(feedbackData, function(id, data) {{
        console.log('here is feedbackData. data is -- ');
        data.id = id;
        data.indexId = parseInt(id) + 1;
        if (isSuccess(data)){{
            data.color = 'green'
        }}else{{
            data.color = 'red'
        }}
        //add the hidden modal
        modal = $(tmpl('tmpl-modal', data));
        $('#modals-' + taskId).append(modal);

        // add row to scenario table
        scenario_row = $(tmpl('tmpl-scenario-row', data));
        $('#scenarios-table-' + taskId).append(scenario_row);

    }});
}


// whether a scenario is success or failure
function isSuccess(data) {{
    return data.result.bool
}}
