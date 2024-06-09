/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var FeedbackPlugin = (function () {
    // Grade categories are always treated as if they are selected, along with their tests.
    const g_grade_categories = ['functionality'];

    // Global variables for data stored in local storage
    var g_currentStep = 1;
    var g_feedback_categories = [];
    var g_feedback_summary = "";

    var g_courseid = "";
    var g_taskid = "";
    var g_submissionid = "";
    var g_student = "";
    var g_submission_url = "";

    // this function is called from feedback_manager.html
    // ---
    function init_manage_feedback_page(input_courseid, input_taskid, input_submissionid, input_student, staff, input_submission_url, database_categories) {
        console.debug('In function: init_manage_feedback_page(%O)', database_categories);
        console.debug('Initial step = %d', g_currentStep);

        g_courseid = input_courseid;
        g_taskid = input_taskid;
        g_submissionid = input_submissionid;
        g_student = input_student;
        g_submission_url = input_submission_url;

        // Student View only; no buttons, all text fields are read only.
        if (staff == 'False') {
            g_currentStep = 3;
        }        
        console.debug('==========');

        // get feedback data from storage, or fronm database if not there
        try {
            load_from_storage();
            console.debug('Initial data from storage = %O', g_feedback_categories);
        } catch (e) {
            g_feedback_categories = database_categories;
            for (const key in g_feedback_categories) {
                g_feedback_categories[key]['tests'].forEach(test => {
                    // set UI id
                    test['ui_id'] = test['category'] + '-' + test['taskid'] + '-' + test['id'];
                    if (g_grade_categories.includes(test['category'])) {
                        test['selected'] = true
                    }
                    else {
                        test['selected'] = false;
                    }
                })
            }    
            save_to_storage();
            console.debug('Initial data from database = %O', g_feedback_categories);
        }
        
        // set UI elements
        for (const key in g_feedback_categories) {
            // key is the category name, in English. For example, coding, design...
            var category = g_feedback_categories[key];
            
            // set category instructor message in UI
            if (category['feedback'] && category['feedback'].length > 0) {
                $("#message-feedback-" + key).val(category['feedback']);
            }

            // go through all the tests associated with the category
            category['tests'].forEach(test => {
                // add test 'additional details'
                add_test_popup(test);

                // add test message
                add_test_messages(test, false);
            })
        }

        // set checkboxes
        for (const cat in g_feedback_categories) {
            for (const t in g_feedback_categories[cat]['tests']) {
                var test = g_feedback_categories[cat]['tests'][t];
                // selected category/test
                if (test['selected']) {
                    var test_checkbox_element = document.getElementById('checkBoxSelect-' + test['ui_id']);
                    var category_checkbox_element = document.getElementById('checkBoxSelect-feedback-' + test['category']);

                    // check category/test
                    test_checkbox_element.checked = true;

                    // TODO not clear what this 'if' is meant to do...
                    var category_name = "";
                    if (test_checkbox_element.value.startsWith("feedback-")) {
                        category_name = test_checkbox_element.id.replace("checkBoxSelect-feedback-", "");
                    } else {
                        category_name = test_checkbox_element.closest('.displayed_feedback').id.replace("feedback-", "");
                    }

                    // default categories cannot be unselected
                    if (g_grade_categories.includes(category_name)) {
                        category_checkbox_element.disabled = true;
                        test_checkbox_element.disabled = true;
                    }
                }
            }
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
        var href = window.location.origin + "/admin/" + g_courseid + "/submissions?download_submission=" + g_submissionid
        var download_btn = $(".download-btn");
        download_btn.attr('href', href);

        // set UI elements
        if (g_currentStep === 1) {
            // no 'back' from STEP 1
            disable_button("back", "true");
            
            // hide instructor comments and total feedback (will apear in STEP 2 & 3)
            $(".message").css("display", "none");

        } else if (g_currentStep ==2 || g_currentStep == 3) {
            // if inital step is 2 or 3, page is updated accordingly
            update_page(g_currentStep);
        } else {
            console.error('Unexpected currentStep = %d', g_currentStep);
        }
    }

    // this function is called when we get back to a feedback page that was already displayed in 
    // the past
    // ---
    function update_page(currentStep) {
        console.debug('==========')
        console.debug('In function: update_page(%d)', currentStep);

        // load data from storafe
        try {
            load_from_storage();
        } catch (e) {
            console.debug("there is nothing in storage");
        }

        // set 'back' and 'next' buttons, based on current step
        disable_button("back", currentStep === 1);
        disable_button("next", currentStep === 3);

        // highlight the associated step indicator, and dimm others
        var _currentStep = currentStep + ""
        $(".step-indicator").css('opacity', '0.3')
        $("div[data-step=" + _currentStep + "]").css('opacity', '1')

        // TODO not clear what this is for
        $(".step"+ _currentStep + "-view").css('display', 'initial');
        $(".step-view").not(".step"+ _currentStep + "-view").css('display', 'none');

        var page_categories = $("#feedbacks .displayed_feedback");
        var page_tests = $("#feedbacks .displayed_test_feedback");

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
            // TODO consider removing ceckboxes from categories
            var checkboxes = $("#feedbacks input[type='checkbox']");
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'initial';
            }

            // show all tests
            for (var i = 0; i < page_tests.length; i++) {
                page_tests[i].style.display = 'flex';
            }

            // show all categories
            for (var i = 0; i < page_categories.length; i++) {
                page_categories[i].style.display = 'flex';

                // hide instructor messages
                var messageInputs = $(".message-" + page_categories[i].id);
                for (var j = 0; j < messageInputs.length; j++) {
                    messageInputs[j].style.display = 'none';
                }
            }

            // hide summary comment
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

            // hide unselected  tests
            for (const cat in g_feedback_categories) {
                var category = g_feedback_categories[cat];
                for (const t in category['tests']) {
                    var test = category['tests'][t];
                    if (!test['selected']) {
                        var test_element = document.getElementById(test['ui_id']);
                        test_element.style.display = 'none';
                    }    
                }
            }

            // show instructor comments box
            console.log('page_categories = %O', page_categories)
            for (var i = 0; i < page_categories.length; i++) {
                var messageInputs = $(".message-" + page_categories[i].id);
                for (var j = 0; j < messageInputs.length; j++) {
                    messageInputs[j].style.display = 'initial';
                }
            }
            // show summary comment
            $(".total-feedback")[0].style.display = 'initial';

        // STEP 3
        // ------
        } else if (currentStep === 3) {
            // show submit/save draft buttons
            $("#submit-buttons")[0].style.display = 'flex';

            make_preview();
        } else {
            console.log('Unexpected currentStep = %d', currentStep);
        }

        window.scrollTo(0,0);
    }

    // this function changes the disable status of buttons (true/false), with a given name
    // for example: next_btn, back_btn.
    // ---
    function disable_button(btn, value) {
        console.debug('In function: disable_button(%s, %s)', btn, value);

        var btns = $("." + btn + "_btn")
        for (i = 0; i < btns.length; i++) {
            btns[i].disabled = value;
        }
    }

    // this function adds the message of a test
    // ---
    function add_test_messages(test, is_draft) {
        // console.debug('In function: add_test_messages(%s, %s)', test['message'], is_draft);

        if (test['message']) {
            var messages = test['message'].split("\n");

            // TODO not clear why this is needed
            var extra_text = is_draft ? "test-" : "";
       
            // insert message html
            messages.forEach(message => {
                message = message.replaceAll(/\"/g, '\\\"')
                var line = $('<p style="margin: 0"></p>');
                line.text(message);
                $("." + extra_text + test['ui_id'] + "-message").append(line);
            })
        }
    }

    // this function creates the 'additional details' popup window for a test
    // ---
    function add_test_popup(test) {
        // console.debug('In function: add_test_popup(%O)', test);

        if ((('cout_text' in test) && test['cout_text'] != 'N/A') || (('cout_file' in test) && test['cout_file'])) {
            $("." + test['ui_id'] + "-popup").css("display", "initial");
        }
    }

    // this functions updates the current step, and refreshes the page accordingly
    // ---
    function update_step(accumulator) {
        console.debug('In function: update_step(%d)', accumulator);

        // update curret step
        g_currentStep += accumulator;
        console.log('    currentStep = %d', g_currentStep);

        // save data
        save_to_storage();

        // update page with new step
        update_page(g_currentStep);
    }

    // this function is called when a user checks/unchecks a tests or category
    // ---
    function select_category_or_test(event) {
        console.debug('In function: select_category_or_test(%O)', event);
        console.log('    value   = %s', event.value);
        console.log('    checked = %s', event.checked);

        if (event.value.startsWith("feedback")) {
            // Category checkbox event
            var checkboxes = $("#" + event.value + " input[type='checkbox']");
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].checked = event.checked;
            }        
        } else {
            // Test checkbox event
            var test_category = event.closest('.displayed_feedback');
            var test_category_checkbox = $("#" + test_category.id + " input[type='checkbox']")[0];

            if (event.checked) {
                var event_test = get_test_from_element_id(event.value)
                console.debug('event_test = %O', event_test);
                // TODO if all tests are checked - check category
            } else {
                // uncheck parent category
                test_category_checkbox.checked = false;
            }
        }

        for (const c in g_feedback_categories) {
            var category = g_feedback_categories[c];
            for (const t in category['tests']) {
                var test = category['tests'][t];
                var test_checkbox = $("#" + "checkBoxSelect-" + test['ui_id'])[0];

                test['selected'] = test_checkbox.checked;
            }
        }

        save_to_storage();
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
                    console.log("update: success");
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
        var test = get_test_from_element_id(test_id);

        // get test cout 
        console.log('test_element = %O', test_element);
        var cout_text = test['cout_text'] || "";

        if (cout_text) {
            print_popup(cout_text);
        } else {
            // this (else) part should never happen - placeholder for future use
            console.log('Unexpected empty test[cout_text]');
            $.ajax({
                    type: "GET",
                    url: window.location.origin + '/feedback/' + g_courseid + "/" + g_taskid + "/" + g_submissionid + '/cout?cout=' + test['cout_file'],
                    success: function(data) {
                        console.log("success");
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
        console.debug('In function: save_to_storage()');

        // summary feedback
        g_feedback_summary = $("#total-feedback").val();

        // save instructor comments and selected tests, for each visible category
        for (const key in g_feedback_categories) {
            var category = g_feedback_categories[key];

            // instructor comments
            category['feedback'] = $("#message-feedback-" + key).val();
        }

        // check if browser supports local storage
        if (typeof (Storage) !== "undefined") {
            // prepare data for saving
            var data = {
                "g_currentStep": g_currentStep,
                "g_feedback_categories": g_feedback_categories,
                "g_feedback_summary": g_feedback_summary,
            };

            console.debug("save_to_storage data = %O", data);

            // save data
            localStorage.setItem(g_submissionid, JSON.stringify(data));
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function loads data from local storage
    // ---
    function load_from_storage() {
        // check if browser supports local storage
        if (typeof (Storage) !== "undefined") {
            // get data from local storage
            var data = localStorage[g_submissionid];
            data = JSON.parse(data);

            g_currentStep = data.g_currentStep ? data.g_currentStep : 1;
            g_feedback_categories = sort_categories(data.g_feedback_categories) ? data.g_feedback_categories : [];
            g_feedback_summary = data.g_feedback_summary ? data.g_feedback_summary : '';

            console.debug('load_from_storage %O', g_feedback_categories);

            // restore instructor comments
            for (const key in g_feedback_categories) {
                $("#message-feedback-" + key).val(g_feedback_categories[key]['feedback']);
            }

            // restore summary feedback
            $("#total-feedback").val(g_feedback_summary)
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function saves a draft of the feedback manager page
    // ---
    function save_draft() {
        console.debug('In function: save_draft()');

        // send save request
        send_save_request(g_feedback_categories,false);

        // save to local storage
        save_to_storage();
    }

    // this function saves a draft of the feedback manager page
    // ---
    function delete_draft() {
        console.debug('In function: delete_draft()');

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([g_submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function submits a final version of feedback
    // ---
    function submit() {
        console.debug('In function: submit()');

        // send save request
        send_save_request(g_feedback_categories, true);

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([g_submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function sends a request to save feedback in the database (draft or final)
    // ---
    function send_save_request(feedback, is_final_version) {
        console.debug('In function: send_save_request(%O, %s)', feedback, is_final_version);

        var feedback_categories_to_send = JSON.parse(JSON.stringify(feedback));
        var category;
        for (const key in feedback_categories_to_send) {
            category = feedback_categories_to_send[key]

            // instructor comments
            category['feedback'] = $("#message-feedback-" + key).val();

            // check if category is selected


            // category selected tests

        };

        // summary feedback
        g_feedback_summary = $("#total-feedback").val();

        // send save request
        var error_message = "";
        $.ajax({
                type: "POST",
                url: window.location.href + "?submit=" + is_final_version,
                contentType: 'application/json',
                data: JSON.stringify({
                    "categories": g_feedback_categories,
                    "feedback_summary": g_feedback_summary,
                    "draft": !is_final_version,
                }),
                success: function(data) {
                    console.log("save: success");

                    // display message to user
                    var message = is_final_version ? "Final feedback was submitted for student " + g_student : "Feedback draft was saved for student " + g_student;
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

    // this function prepares a preview of the feedback (STEP 3)
    // ---
    function make_preview() {
        console.debug('In function: make_preview()');

        // send preview request
        send_preview_request();

        // save to local storage
        save_to_storage();
    }

    // this function send a preview request
    // ---
    function send_preview_request() {
        console.debug('In function: send_preview_request()');

        $.ajax({
                type: "POST",
                url: g_submission_url + "/preview",
                contentType: 'application/json',
                data: JSON.stringify({
                    "categories": g_feedback_categories,
                    "feedback_summary": g_feedback_summary,
                }),
                success: function(response) {
                    console.debug("preview: success");

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
        console.debug('In function: render_student_feedback(\n    %O,\n    %s,\n    %s,\n    %s\n    %s)', 
                    feedback_data, input_courseid, input_taskid, input_submissionid, staff);
        
        if (feedback_data.categories.length == 0) {
            try {
                load_from_storage();
                feedback_data['categories'] = g_feedback_categories;
                feedback_data['feedback_summary'] = g_feedback_summary;
            } catch (e) {
                console.debug("there is nothing in storage");
            }    
        }
        
        console.debug("feedback_data = %O", feedback_data);

        // get inputs
        g_courseid = input_courseid;
        g_taskid = input_taskid;
        g_submissionid = input_submissionid;

        // render summary feedback
        var feedback_summary_data = "<None>";
        if (feedback_data['feedback_summary']) {
            feedback_summary_data = feedback_data['feedback_summary']
        }
        var feedback_summary_element = $(tmpl('tmpl-total-feedback', feedback_summary_data));
        $('#scenarios-table').append(feedback_summary_element);

        // render categories
        var category_section;
        var sorted_feedback_categories = sort_categories(feedback_data['categories']);
        for (const key in sorted_feedback_categories) {
            var category_data = sorted_feedback_categories[key]

            category_data["category"] = key
            category_section = $(tmpl('tmpl-category', category_data));
            $('#scenarios-table').append(category_section);

            // for default categories (e.g., functionality) set color based on status
            if (g_grade_categories.includes(key)) {
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

            // category tests
            category_data['tests'].forEach(test => {
                if (test['selected']) {
                    if (g_grade_categories.includes(test['category'])) {
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
                    console.debug('test = %O', test);
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

    // this function sorts a list of categories: defualt categories first
    function sort_categories(categories_to_sort) {
        console.debug('In function: sort_categories(%O)', categories_to_sort);

        var keys = Object.keys(categories_to_sort);
        keys.sort((k1, k2) => {
            // default category before non-default category
            if (g_grade_categories.includes(k1) && !g_grade_categories.includes(k2)) {
                return -1;
            } else if (!g_grade_categories.includes(k1) && g_grade_categories.includes(k2)) {
                return 1;
            } else if (g_grade_categories.includes(k1) && g_grade_categories.includes(k2)) {
                // default categories in the order they are defined
                return g_grade_categories.indexOf(k1) < g_grade_categories.indexOf(k2) ? -1 : 1;
            }
            // regular order for non-default categories
            return k1.localeCompare(k2);
        })

        // build sorted category list
        var sorted_categories = {};
        for (const key of keys) {
            sorted_categories[key] = categories_to_sort[key];
        }
        return sorted_categories;
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

        for (const cat in g_feedback_categories) {
            for (t in g_feedback_categories[cat]['tests']) {
                var test = g_feedback_categories[cat]['tests'][t];

                if (event.value == test['ui_id']) {
                    console.debug('test_name = %O', test_name);
                    test['name'] = test_name.innerHTML;
                    test['message'] = test_message.innerHTML;
                }
            }
        }

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

    function get_test_from_element_id(element_id) {
        for (const c in g_feedback_categories) {
            for (const t in g_feedback_categories[c]['tests']) {
                var test = g_feedback_categories[c]['tests'][t];
                if (test['ui_id'] == element_id) {
                    return test;
                }
            }
        }
        return null;
    }

    return {
        init_manage_feedback_page: init_manage_feedback_page,
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