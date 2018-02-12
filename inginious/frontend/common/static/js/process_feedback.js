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
        var command_line = feedbackData['prompt'];
        for (var i = 0; i < feedbackData.args.length; i++) {
            command_line += " " + feedbackData.args[i];
        }
    }
    $("#scenario_log" + scenarioIdStr).append('<li>' + command_line + '<li>');
    if (feedbackData.log) {
        for (var i = 0; i < feedbackData.log.quotes.length; i++) {
            var cleanStr = checkForTabs(feedbackData.log.quotes[i].value)
            if(i == 0) {
                var line = $('<li></li>');
                var text = '';
                text += cleanStr;
            }
            else if(feedbackData.log.quotes[i].value.includes(String.fromCharCode(13))){
                if(i != 0){
                    text += cleanStr;
                    line.text(text);
                }
                 var line = $('<li></li>');
                 var text = '';
            }else{
                text += cleanStr;
                line.text(text);
            }

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

function checkForTabs(str){

    var needle = String.fromCharCode(9);
    var regex = new RegExp(needle, 'g');
    var replaceWith = String.fromCharCode(160);
    return str.replace(regex, replaceWith);
}

function generateSentSignature(data){
    var methodName = data.method_name || 'solution';
    var argumentsSent = data.arguments_sent;
    //var argsString = convertArgs(argumentsSent);
    return methodName + '(' +  String(argumentsSent) + ')';
}

function renderScenarioRows(feedbackData, taskId) {
    var scenario_row,
        modal, checkPrint;
    console.log('here is feedbackData. ');
    console.log(feedbackData);


    $.each(feedbackData, function (id, data) {
        {
            //feedbackData[id]['expected'] = convertToString(feedbackData[id]['expected'])
            //feedbackData[id]['returned_value'] = convertToString(feedbackData[id]['returned_value'])
            console.log('here is feedbackData. data is -- ');
            data.id = id;
            data.indexId = parseInt(id) + 1;
            data.noValue = 'אין ערך החזרה'
            if (isSuccess(data)) {
                {
                    data.color = 'green';
                    data.colorIconExpected = 'icon-color-green';
                    data.colorIconPrint = 'icon-color-green'
                }
            } else {
                {
                    data.color = 'red';
                    data.colorIconExpected = 'icon-color-red'
                }
                if(feedbackData[id]['feedback']['text']=='PrintOutException'){
                    data.colorIconPrint = 'icon-color-red';
                    if(feedbackData[id]['returned_value'] == feedbackData[id]['expected']){
                        data.colorIconExpected = 'icon-color-green'
                    }
                }
            }



            if (feedbackData[id]['test']){
                checkPrint = feedbackData[id]['test'][0]['expected_stdout']
            }else{
                checkPrint = false
            }


            //add the hidden modal
            modal = $(tmpl('tmpl-modal', data));
            $('#modals-' + taskId).append(modal);

            // in python's case, this data wil be presented in the feedback table like so
            // my_function(1,"foo", "bar")

            data.sentToFunction = generateSentSignature(data);
            // add row to scenario table
            if(checkPrint){
                data.expectedPrint = checkPrint
                scenario_row = $(tmpl('tmpl-scenario-row-print-out', data));
                $('.print-head').show()
            }else{
                scenario_row = $(tmpl('tmpl-scenario-row', data));
                $('.print-head').hide()
            }
            $('#scenarios-table-' + taskId).append(scenario_row);

        }
    });

    // relevant to python's feedback only, will do nothing in other courses
    if (feedbackData[0] && feedbackData[0].method_signature) {
        $('#scenarios-table-' + taskId + ' #method-signature').html(feedbackData[0].method_signature)
    }

}


// whether a scenario is success or failure
function isSuccess(data) {{
    return data.result.bool
}}

function convertArgs(args) {

    if(args == undefined){
     return ''
    }

    var stringArgs = [];

    $.each(args, function (index, data) {

        stringArgs[index] = convertToString(data)
    })

    return stringArgs;
}

function convertToString(data) {

     var type = typeof (data);

     switch (type) {
         case "object":
             return "[" + data.join(", ") + "]";
             break;
         case "number":
             return data;
             break;
         case "string":
             return '"' + data + '"';
             break;
         case "boolean":
             return data.toString();
             break;
         default:
             return data;
     }
}