/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var FeedbackPlugin = (function () {
    const grade_categories = ['functionality']

    var global_feedback = {};
    var currentStep = 1;
    var courseid = ""
    var taskid = ""
    var submissionid = ""
    var student = ""
    var tasktype = ""
    var total_feedback = ""
    var submission_url = ""

    // this function is called from feedback_manager.html
    // ---
    function init_variables(input_courseid, input_taskid, input_submissionid, input_student, input_tasktype, staff, input_submission_url) {
        console.debug("==========");
        console.debug('init_variables(staff=%s)', staff); 

        global_feedback = {};
        courseid = input_courseid;
        taskid = input_taskid;
        submissionid = input_submissionid;
        student = input_student;
        tasktype = input_tasktype
        submission_url = input_submission_url
        
        load_from_storage();

        if (staff == 'False') {
            // STEP 3 = Student View only; no buttons, all text fields are read only.
            currentStep = 3;
        }        
    }

    // this function is called from feedback_manager.html
    // ---
    function init_manage_feedback_page(initial_feedback) {
        console.debug('In function: init_manage_feedback_page(%O)', initial_feedback);

        global_feedback['categories'] = initial_feedback;
        global_feedback['instructor_total_feedback'] = "";
        for (const category_name in initial_feedback) {
            // key is the category name, in English. For example, coding, design...
            var category = initial_feedback[category_name];

            // set test uniqueu UI id
            category['tests'].forEach(test => {
                test['ui_id'] = test['category'] + '-' + test['taskid'] + '-' + test['id'];
            })

            // check if there is already instructor feedback for this category
            // and if so, copy it to text field
            if (category['feedback'] && category['feedback'].length > 0) {
                var instructor_message_element = document.getElementsByClassName("#message-feedback-" + category_name)[0];
                instructor_message_element.val(category['feedback']);
            }

            var category_checkbox_element = document.getElementById('checkBoxSelect-feedback-' + category_name);
            category_checkbox_element.checked = true;

            category['tests'].forEach(test => {
                var test_checkbox_element = document.getElementById('checkBoxSelect-' + test['ui_id']);
                var test_message_element = document.getElementsByClassName(test['ui_id'] + '-message')[0];

                test_message_element.innerHTML = test['message'];    
                // check if test is selected
                if (grade_categories.includes(category_name)) {
                    // special handling of grading category (i.e., functionality)
                    category_checkbox_element.disabled = true;
                    test_checkbox_element.checked = true;
                    test_checkbox_element.disabled = true;                
                }
                else if ('selected' in test && test['selected']) {
                    test_checkbox_element.checked = true;
                }
                else {
                    test_checkbox_element.checked = false;

                    category_checkbox_element.checked = false;
                }               

                // add test 'additional details'
                add_test_popup(test);

                // add test message
                add_test_messages(test, false);
            })
        }

        // set 'next student' button functionality
        var next_student_btn = $(".next-student-btn");
        next_student_btn.click(function() {
            // save current student to storage
            save_to_storage();

            // send a get next request
            $.ajax({
                type: "GET",
                url: window.location.href + "/next",
                success: function(response) {
                    console.log("next: success");
                    if (response) {
                        send_request_for_another_student(response);
                    } else {
                        studio_display_feedback_submit_message("No more students made submission for this course", "", "danger", true);
                    }
                },
                error: function (e) {
                    console.log("next: " + e.toString())
                },
            });
        })

        // set 'previous student' button functionality
        var previous_student_btn = $(".previous-student-btn");
        previous_student_btn.click(function() {
            // save current student to storage
            save_to_storage();
            
            // send a get prev request
            $.ajax({
                type: "GET",
                url: window.location.href + "/prev",
                success: function(response) {
                    console.log("prev: success");
                    if (response) {
                        send_request_for_another_student(response);
                    } else {
                        studio_display_feedback_submit_message("No more students made submission for this course", "", "danger", true);
                    }
                },
                error: function (e) {
                    console.log("prev: " + e.toString())
                },
            });
        })

        // set 'download' button
        var href = window.location.origin + "/admin/" + courseid + "/submissions?download_submission=" + submissionid
        var download_btn = $(".download-btn");
        download_btn.attr('href', href);

        // set UI elements
        save_to_storage();
        update_page(currentStep);
    }

    // this function is called when we get back to a feedback page that was already displayed in 
    // the past
    // ---
    function update_page(currentStep) {
        console.debug('update_page(step=%d)', currentStep);
        // load data from storage
        load_from_storage();

        // set 'back' and 'next' buttons, based on current step
        disable_button("back", currentStep === 1);
        disable_button("next", currentStep === 3);

        // highlight the associated step indicator, and dimm others
        var _currentStep = currentStep + ""
        $(".step-indicator").css('opacity', '0.3')
        $("div[data-step=" + _currentStep + "]").css('opacity', '1')

        // show only current step elements
        $(".step"+ _currentStep + "-view").css('display', 'initial');
        $(".step-view").not(".step"+ _currentStep + "-view").css('display', 'none');
        
        // STEP 1
        // ------
        if (currentStep === 1) {
            // hide submit/save buttons
            $("#submit-buttons")[0].style.display = 'none';

            // hide test edit buttons
            var buttons = document.getElementsByTagName('button');
            for (let i = 0; i < buttons.length; i++) {
                if (buttons[i].classList.contains('edit_btn') ||
                    buttons[i].classList.contains('save_btn') ||
                    buttons[i].classList.contains('cancel_btn')) {
                    buttons[i].style.display = 'none';
                    }
            }

            // show category and test checkboxes
            var checkboxes = $("#feedbacks input[type='checkbox']");
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'initial';
            }

            for (cat in global_feedback['categories']) {
                // show all tests
                for (var i = 0; i < checkboxes.length; i++) {
                    if (checkboxes[i].id.startsWith('checkBoxSelect-' + cat + '-'))  {
                        var test_element = document.getElementById(checkboxes[i].value);
                        test_element.style.display = 'flex';
                    }
                }

                // hide instructor comments
                var instructor_message_element = document.getElementById("message-feedback-" + cat);
                instructor_message_element.style.display = 'none';
            }

            // hide summary instructor comment
            $(".total-feedback")[0].style.display = 'none';

        // STEP 2
        // ------
        } else if (currentStep === 2) {
            // hide submit/save draft buttons
            $("#submit-buttons")[0].style.display = 'none';

            // show edit buttons
            var buttons = document.getElementsByTagName('button');
            for (let i = 0; i < buttons.length; i++) {
                if (buttons[i].classList.contains('edit_btn') ||
                    buttons[i].classList.contains('save_btn') ||
                    buttons[i].classList.contains('cancel_btn'))
                buttons[i].style.display = 'initial';
            }

            // hide category and test checkboxes
            var checkboxes = $("#feedbacks input[type='checkbox']");
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'none';
            }

            for (cat in global_feedback['categories']) {
                // show only selected tests
                for (var i = 0; i < checkboxes.length; i++) {
                    if ((checkboxes[i].id.startsWith('checkBoxSelect-' + cat + '-')) && 
                        (!checkboxes[i].checked)) {
                        var test_element = document.getElementById(checkboxes[i].value);
                        test_element.style.display = 'none';
                    }
                }

                // show instructor comments box
                var instructor_message_element = document.getElementById("message-feedback-" + cat);
                instructor_message_element.style.display = 'initial';
            }

            // show summary instructor comment
            $(".total-feedback")[0].style.display = 'initial';

        // STEP 3
        // ------
        } else if (currentStep === 3) {
            // show submit/save draft buttons
            $("#submit-buttons")[0].style.display = 'flex';

            send_preview_request();
        } else {
            console.log('Unexpected currentStep = %d', currentStep);
        }

        window.scrollTo(0,0);
    }

    // this function changes the disable status of buttons (true/false), with a given name
    // for example: next_btn, back_btn.
    // ---
    function disable_button(btn, value) {
        var btns = $("." + btn + "_btn")
        for (i = 0; i < btns.length; i++) {
            btns[i].disabled = value;
        }
    }

    // this function adds the message of a test
    // ---
    function add_test_messages(test, is_draft) {
        // console.debug('In function: add_test_messages(%O, %s)', test, is_draft);

        if (test['message']) {
            var messages = test['message'].split("\n");

            // TODO not clear why this is needed
            var extra_text = is_draft ? "test-" : "";
       
            // insert message html
            messages.forEach(message => {
                message = message.replaceAll(/\"/g, '\\\"')
                var line = $('<p style="margin: 0"></p>');
                line.text(message);
                $("." + extra_text + test['id'] + "-message").append(line);
            })
        }
    }

    // this function creates the 'additional details' popup window for a test
    // ---
    function add_test_popup(test) {
        // console.debug('In function: add_test_popup(%O)', test);

        if ((('cout_text' in test) && test['cout_text'] && test['cout_text'] != 'N/A') || 
            (('cout_file' in test) && test['cout_file'])) {
            $("." + test['ui_id'] + "-popup").css("display", "initial");
        }
    }

    // this functions updates the current step, and refreshes the page accordingly
    // ---
    function update_step(accumulator) {
        console.debug("==========");
        console.debug('update_step from %d to %d', currentStep, currentStep+accumulator);

        // update curret step
        currentStep += accumulator;

        // save data
        save_to_storage();

        // update page with new step
        update_page(currentStep);
    }

    // this function is called when a user checks/unchecks a tests or category
    // TODO split category and test
    // ---
    function select_category_or_test(event) {
        console.debug('In function: select_category_or_test(%O)', event);

        if (event.checked) {
            if (event.value.startsWith("feedback")) {
                // category checked - check all subsequent tests
                var checkboxes = $("#" + event.value + " input[type='checkbox']");
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = true;
                }
            } else {
                // make parent category visible
                var test_category = event.closest('.displayed_feedback');

                // category should be checked only if all subsequent tests are checked
                var category_children = $("#" + test_category.id + " .displayed_test_feedback");
            }
        } else {
            if (event.value.startsWith("feedback")) {
                // category unchecked - uncheck all subsequent tests
                var checkboxes = $("#" + event.value + " input[type='checkbox']");
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = false;
                }
            } else {
                // test unchecked

                // uncheck parent category
                var test_category = event.closest('.displayed_feedback');
                var checkbox = $("#" + test_category.id + " input[type='checkbox']")[0];
                checkbox.checked = false;

                // if no test left selected, hide category
            }
        }
    }

    // this function send a request to fetch another student feedback, following pushing
    // the next/previous student button
    // ---
    function send_request_for_another_student(response) {
        console.debug('In function: send_request_for_another_student(%O)', response);

        if (response) {
            var href = window.location.href.split("/");
            href[href.length - 1] = response;
            href = href.join('/');
            $.ajax({
                type: "GET",
                url: href,
                success: function(response) {
                    window.location = href;
                },
                error: function (e) {
                    console.log("update: " + e.toString());
                },
            });
        } else {
            console.log("no more students made submission for this task")
        }
    }

    // this function is called when the 'additional details' button is pressed
    // for a specific tests. it prepares the cout text and shows it in a popup.
    // ---
    function open_popup(event) {
        console.debug('In function: open_popup(%O)', event);

        // find associated test
        const test_element = event.closest(".displayed_test_feedback");
        const test_id = test_element.attributes['id'].value;
        
        var found = false;
        for (const cat in global_feedback['categories']) {
            if (found) {
                break;
            }
            for (const t in global_feedback['categories'][cat].tests) {
                var test =  global_feedback['categories'][cat].tests[t];
                if (test['ui_id'] == test_id) {
                    found = true;
                    break;``
                }
            }
        }

        console.log('test_id = %O', test_id);
        console.log('test_element = %O', test_element);
        console.log('test = %O', test);

        // get test cout 
        var cout_text = test['cout_text'] || "";

        if (cout_text) {
            print_popup(cout_text);
        } else {
            // this (else) part should never happen - placeholder for future use
            console.log('Unexpected empty test[cout_text]');
            $.ajax({
                    type: "GET",
                    url: window.location.origin + '/feedback/' + courseid + "/" + taskid + "/" + submissionid + '/cout?cout=' + test['cout_file'],
                    success: function(data) {
                        print_popup(data);
                    },
                    error: function (e) {
                        var line;
                        console.log(e)
                        line = $('<li></li>');
                        line.text("Internal server error");
                        $("#popup-text").append(line);
                    },
            })
        }

        // display additional details popup
        $("#popup").css("display", "initial");
    }

    // this function prepares the text for display in popup
    // ---
    function print_popup(data) {
        console.debug('In function: print_popup(%s)', data);

        var line;
        data.split("\n").forEach(text => {
            line = $('<li></li>');
            line.text(text);
            $("#popup-text").append(line);
        })
    }

    // this function closes the popup window.
    // ---
    function close_popup (event) {
        console.debug('In function: close_popup(%O)', event);

        $("#popup").css("display", "none");
        $("#popup-text").empty();
    }

    // this function save page content to local storage
    // ---
    function save_to_storage() {
        var category;
        var test;
        var tests;
        var selected_element;
        var name_element;
        var message_element;
        var storage_data = {};

        // save global_feedback and their tests
        for (var c in global_feedback['categories']) {
            category = global_feedback['categories'][c];

            tests = category['tests'];
            // tests
            for (var t = 0; t < tests.length; t++) {
                test = tests[t];

                // test selected flag
                selected_element = document.getElementById("checkBoxSelect-" + test['ui_id']);
                test['selected'] = selected_element.checked;

                // test name
                name_element = document.getElementsByClassName(test['ui_id'] + "-name")[0];
                test['name'] = name_element.innerHTML;

                // test message
                message_element = document.getElementsByClassName(test['ui_id'] + "-message")[0];
                test['message'] = message_element.innerHTML;
            }

            // instructor comments
            category['instructor_feedback'] = $("#message-feedback-" + c).val();
        }

        // summary feedback
        global_feedback['instructor_total_feedback'] = $("#total-feedback").val();

        storage_data['feedback'] = global_feedback;

        // current step
        storage_data['currentStep'] =  currentStep;

        // save time and version for debug purposes
        storage_data['saveTime'] =  new Date().toLocaleString();
        var footer_element = document.getElementById("footer");
        var footer =  footer_element.innerHTML.split('INGInious ');
        footer = footer[1].split(' ');
        storage_data['saveVersion'] = footer[0];

        // check if browser supports local storage
        if (typeof (Storage) !== "undefined") {
            // save data
            localStorage.setItem(submissionid, JSON.stringify(storage_data));
            console.debug("saved global_feedback=%O",global_feedback);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function loads data from local storage
    // ---
    function load_from_storage() {
        var category;
        var test;
        var tests;
        var selected_element;
        var name_element;
        var message_element;
        var storage_data;

        // check if browser supports local storage
        if (typeof (Storage) !== "undefined") {
            // get data from local storage
            
            try {
                storage_data = localStorage[submissionid];
                storage_data = JSON.parse(storage_data);
            }
            catch(e) {
                console.debug('nothing loaded from storage - %s', submissionid);
                return;
            }         
        }
        else {
            alert("Your browser doesn't support web storage");
        }

        // set global var
        global_feedback = storage_data['feedback'];
        console.debug('loaded global_feedback=%O', global_feedback);

        // current step
        currentStep = storage_data['currentStep'];

        return;
        // restore global_feedback and their tests
        for (var c in global_feedback['global_feedback']) {
            category = global_feedback['global_feedback'][c];
          
            tests = category['tests'];
            // tests
            for (var t = 0; t < tests.length; t++) {
                test = tests[t];

                // test selected flag
                selected_element = document.getElementById("checkBoxSelect-" + test['ui_id']);
                selected_element.checked = test['selected'];

                // test name
                name_element = document.getElementsByClassName(test['ui_id'] + "-name")[0];
                name_element.innerHTML = test['name'];

                // test message
                message_element = document.getElementsByClassName(test['ui_id'] + "-message")[0];
                message_element.innerHTML = test['message'];
            }

            // instructor comments
            $("#message-feedback-" + c).val(category['instructor_feedback']);
        }

        // summary feedback
        $("#total-feedback").val(global_feedback['instructor_total_feedback']);

        return storage_data;
    }

    // this function saves a draft of the feedback manager page
    // ---
    function save_draft() {
        console.debug('In function: save_draft()');

        // send save request
        send_save_request(global_feedback,false);

        // save to local storage
        save_to_storage();
    }

    // this function saves a draft of the feedback manager page
    // ---
    function delete_draft() {
        console.debug('In function: delete_draft()');

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem(submissionid);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function submits a final version of feedback
    // ---
    function submit() {
        console.debug('In function: submit()');

        // send save request
        send_save_request(global_feedback, true);

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function sends a request to save feedback in the database (draft or final)
    // ---
    function send_save_request(feedback, is_final_version) {
        console.debug('In function: send_save_request(%O, %s)', feedback, is_final_version);

        var feedback_global_feedback = JSON.parse(JSON.stringify(feedback));
        var category;
        for (const key in feedback_global_feedback) {
            category = feedback_global_feedback[key]

            // instructor comments
            category['feedback'] = $("#message-feedback-" + key).val();
        };

        // summary feedback
        total_feedback = $("#total-feedback").val();

        // send save request
        var error_message = "";
        $.ajax({
                type: "POST",
                url: window.location.href + "?submit=" + is_final_version,
                contentType: 'application/json',
                data: JSON.stringify({
                    "global_feedback": feedback_global_feedback,
                    "total_feedback": total_feedback,
                    "draft": !is_final_version,
                }),
                success: function(data) {
                    // display message to user
                    var message = is_final_version ? "Final feedback was submitted for student " + student : "Feedback draft was saved for student " + student;
                    studio_display_feedback_submit_message(message, "", "success", true);
                },
                error: function (e) {
                    console.log("save: " + e.toString());

                    // display message to user
                    error_message = "An internal error occurred";
                    studio_display_feedback_submit_message("Some error(s) occurred when saving the feedback: " + error_message, "", "danger", true);
                },
        });
    }

    // this function displays a message to the user, and hides it after 3 seconds
    function studio_display_feedback_submit_message(title, content, type, dismissible)
    {
        console.debug('In function: studio_display_feedback_submit_message(\n    %s,\n    %s,\n    %s,\n    %s)', 
                    title, content, type, dismissible);

        // get message html code
        var code = getAlertCode(title, content, type, dismissible);

        // insert html code
        $('#feedback_submit_status').html(code);

        // scroll to top
        window.scrollTo(0,0);

        // remove message after set timeout (3 sec)
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

    // this function send a preview request
    // ---
    function send_preview_request() {
        console.debug('In function: send_preview_request(global_feedback=%O)', global_feedback);

        $.ajax({
                type: "POST",
                url: submission_url + "/preview",
                contentType: 'application/json',
                data: JSON.stringify({
                    "global_feedback": global_feedback['categories'],
                    "total_feedback": global_feedback['instructor_total_feedback'],
                }),
                success: function(response) {
                    // get preview from server
                    var html = response.replace(/.. raw:: html/g, "");
                    $("#draft").html(html);
                },
                error: function (e) {
                    console.log("preview: " + e.toString())
                },
        });
    }

    // this function renders a student's feedback, when the student_feedback_template is shown
    // ---
    function render_student_feedback(feedback_data, input_courseid, input_taskid, input_submissionid, staff) {  
        console.debug("render_student_feedback(feedback_data=%O)", feedback_data);     
        // load_from_storage();
        // console.debug("render_student_feedback(staff=%s) with global_feedback loaded from storage = %O", staff, global_feedback);
        // feedback_data['global_feedback'] = global_feedback['global_feedback'];
        // feedback_data['instructor_total_feedback'] = global_feedback['instructor_total_feedback'];
        
        // get inputs
        courseid = input_courseid;
        taskid = input_taskid;
        submissionid = input_submissionid;

        // render summary feedback
        var total_feedback_data = "<None>";
        console.debug("feedback_data=%O", feedback_data);
        if (feedback_data['total_feedback']) {
            total_feedback_data = feedback_data['total_feedback'];
        }
        var total_feedback_element = $(tmpl('tmpl-total-feedback', total_feedback_data));
        $('#scenarios-table').append(total_feedback_element);

        // render global_feedback
        var category_section;
        var feedback_global_feedback = sort_global_feedback(feedback_data['global_feedback']);
        for (const key in feedback_global_feedback) {
            var category_data = feedback_global_feedback[key]

            category_data["category"] = key
            category_section = $(tmpl('tmpl-category', category_data));
            $('#scenarios-table').append(category_section);

            // for default global_feedback (e.g., functionality) set color based on status
            if (grade_categories.includes(key)) {
                var color = '#5bc0de';
                if (category_data['status']['percent'] == 100) {
                    color = '#318331'
                } else if (category_data['status']['percent'] > 80) {
                    color = '#e4e729'
                } else if (category_data['status']['percent'] > 50) {
                    color = '#ffbc40'
                } else {
                    color = '#fd4242'
                }
                $('#feedback-' + key + ' .category-header').css('background-color', color);
                var info = $('<span></span>');

                // category headline text
                info.text(' - ' + category_data['status']['passed'] + '/' + category_data['status']['total'] + ' ' + category_data['status']['percent'] + '%');
                $('#feedback-' + key + '-info').append(info);
            }

            // show instructor comments box
            var instructor_message_element = document.getElementById("message-feedback-" + key);
            instructor_message_element.style.display = 'initial';
            
            // category tests
            category_data['tests'].forEach(test => {
                if (test['selected']) {
                    // test['id'] = test['category'] + '-' + test['taskid'] + '-' + test['id'];
                    // for default global_feedback (e.g., functionality) border color is set according to test result
                    if (grade_categories.includes(test['category'])) {
                        if (test['result']['text'] === 'passed') {
                            test["border_color"] = 'green';
                        } else if (test['result']['text'] === 'failed') {
                            test["border_color"] = 'red';
                        }
                    }

                    // add test box
                    var test_section = $(tmpl('tmpl-test', test));
                    $('#feedback-' + key + '-tests .test-container').append(test_section);

                    // add test popup
                    add_test_popup(test);

                    // add test message
                    add_test_messages(test, true);
                }
            })

            // TODO don't know what this is
            $('.print-head').hide()
        };

        // TODO not sure what this is and why is it outside the loop
        if (feedback_data['draft'] === false) {
            var popup_section = $(tmpl('tmpl-popup', category_data));
            $('#scenarios-table').append(popup_section);
        }

        // For student view - disable all active UI eleemnts
        if (staff == 'False') {
            $(".page-actions-container").css("display", "none");
            $(".previous-student-btn").css("display", "none");
            $(".next-student-btn").css("display", "none");
            $(".download-btn").css("display", "none");
        }
    }

    // this function sorts a list of global_feedback: defualt global_feedback first
    function sort_global_feedback(feedback_global_feedback) {
        console.debug('In function: sort_global_feedback(%O)', feedback_global_feedback);

        var keys = Object.keys(feedback_global_feedback);
        keys.sort((k1, k2) => {
            // default category before non-default category
            if (grade_categories.includes(k1) && !grade_categories.includes(k2)) {
                return -1;
            } else if (!grade_categories.includes(k1) && grade_categories.includes(k2)) {
                return 1;
            } else if (grade_categories.includes(k1) && grade_categories.includes(k2)) {
                // default global_feedback in the order they are defined
                return grade_categories.indexOf(k1) < grade_categories.indexOf(k2) ? -1 : 1;
            }
            // regular order for non-default global_feedback
            return k1.localeCompare(k2);
        })

        // build sorted category list
        var sorted_global_feedback = {};
        for (const key of keys) {
            sorted_global_feedback[key] = feedback_global_feedback[key];
        }
        return sorted_global_feedback;
    }

    function edit_result(event) {
        console.log("edit_result - %O", event);

        // update buttons state
        let el = event.nextSibling;
        while (el) {
            if (el.type == 'button' && el.classList) {
                if (el.classList.contains("cancel_btn")) {
                    el.disabled = false;
                    el.classList.remove("disabled");
                }
                else if (el.classList.contains("save_btn")) {
                    el.disabled = false;
                    el.classList.remove("disabled");
                }
            }
            el = el.nextSibling;
        }
        event.disabled = true;
        event.classList.add("disabled");
        
        // make name and message editable
        var test_name = document.getElementsByClassName(event.value + '-name')[0];
        var test_message = document.getElementsByClassName(event.value + '-message')[0];
        
        test_name.setAttribute("contenteditable", "");
        test_name.setAttribute("original_text", test_name.innerHTML);

        test_message.setAttribute("contenteditable", "");
        test_message.setAttribute("original_text", test_message.innerHTML);

        // set focus to message
        test_message.focus();
    }

    function save_edit(event) {
        console.log("save_edit - %O", event);

        var test_name = document.getElementsByClassName(event.value + '-name')[0];
        var test_message = document.getElementsByClassName(event.value + '-message')[0];

        test_name.removeAttribute("original_text");
        test_message.removeAttribute("original_text");

        // update buttons state
        var elements = event.parentElement.children;
        for (var el = 0; el < elements.length; el++) {
            if (elements[el].type == 'button' && elements[el].classList) {
                if (elements[el].classList.contains("edit_btn")) {
                    elements[el].disabled = false;
                    elements[el].classList.remove("disabled");
                }
                else if (elements[el].classList.contains("cancel_btn")) {
                    elements[el].disabled = true;
                    elements[el].classList.add("disabled");
                }
                else if (elements[el].classList.contains("save_btn")) {
                    elements[el].disabled = true;
                    elements[el].classList.add("disabled");
                }
            }
        }
        
        test_name.removeAttribute("contenteditable");
        test_message.removeAttribute("contenteditable");

        document.activeElement.blur();
    }

    function cancel_edit(event) {
        console.log("cancel_edit - %O", event);

        var test_name = document.getElementsByClassName(event.value + '-name')[0];
        var test_message = document.getElementsByClassName(event.value + '-message')[0];

        test_name.innerHTML = test_name.getAttribute("original_text");
        test_message.innerHTML = test_message.getAttribute("original_text");

        test_name.removeAttribute("original_text");
        test_message.removeAttribute("original_text");

        // update buttons state
        var elements = event.parentElement.children;
        for (var el = 0; el < elements.length; el++) {
            if (elements[el].type == 'button' && elements[el].classList) {
                if (elements[el].classList.contains("edit_btn")) {
                    elements[el].disabled = false;
                    elements[el].classList.remove("disabled");
                }
                else if (elements[el].classList.contains("cancel_btn")) {
                    elements[el].disabled = true;
                    elements[el].classList.add("disabled");
                }
                else if (elements[el].classList.contains("save_btn")) {
                    elements[el].disabled = true;
                    elements[el].classList.add("disabled");
                }
            }
        }

        test_name.removeAttribute("contenteditable");
        test_message.removeAttribute("contenteditable");
 
        document.activeElement.blur();
    }

    return {
        init_manage_feedback_page: init_manage_feedback_page,
        init_variables: init_variables,
        update_step: update_step,
        select_category_or_test: select_category_or_test,
        save_to_storage: save_to_storage,
        load_from_storage: load_from_storage,
        save_draft: save_draft,
        submit: submit,
        open_popup: open_popup,
        close_popup: close_popup,
        render_student_feedback: render_student_feedback,
        edit_result: edit_result,
        save_edit: save_edit,
        cancel_edit: cancel_edit
    }

})(jQuery);
