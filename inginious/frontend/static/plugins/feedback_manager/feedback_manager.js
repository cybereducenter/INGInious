/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var FeedbackPlugin = (function () {
    // Default categories are always treated as if they are selected, along with their
    // underlined tests.
    const default_categories = ['functionality']

    var currentStep = 1
    var filter = "all"
    var courseid = ""
    var taskid = ""
    var submissionid = ""
    var student = ""
    var tasktype = ""
    var checkedSections = []
    var displayedSections = []
    var categories = []
    var tests = {}
    var draft_categories = []
    var total_feedback = ""

    // this function is called from feedback_manager.html
    // ---
    function init_variables(input_courseid, input_taskid, input_submissionid, input_student, input_tasktype) {
        console.debug('In function: init_variables(\n    %s, \n    %s, \n    %s, \n    %s, \n    %s)', 
                     input_courseid, input_taskid, input_submissionid, input_student, input_tasktype);
        
        courseid = input_courseid;
        taskid = input_taskid;
        submissionid = input_submissionid;
        student = input_student;
        tasktype = input_tasktype
        try {
            load_from_storage();
        } catch (e) {
            console.log("there is nothing in storage");
        }
        
    }

    // this function is called from feedback_manager.html
    // ---
    function init_manage_feedback_page(feedbacks) {
        console.debug('In function: init_manage_feedback_page(%O)', feedbacks);
        for (const cat in Object.keys(feedbacks)) {
            console.debug('    %s', Object.keys(feedbacks)[cat]);
        }
        // console.debug('Initial step = %d', currentStep);

        categories = feedbacks;
        for (const key in feedbacks) {
            // key is the category name, in English. For example, coding, design...
            var category = feedbacks[key];
            
            // set test uniqueu id
            category['tests'].forEach(test => {
                test['id'] = test['category'] + '-' + test['name'] + '-' + test['taskid'];
            })

            // check if there is already instructor feedback for this category
            // and if so, copy it to text field
            if (category['feedback'] && category['feedback'].length > 0) {
                $("#message-feedback-" + key).val(category['feedback']);
            }

            // check if category is selected
            // categories are always displayed. The checkbox near the category name
            // is only a shortcut to selection of all tests in category??
            displayedSections.push('feedback-' + key);
            if ('selected' in category) {
                if (category['selected'] && !checkedSections.includes('feedback-' + key)){
                    checkedSections.push('feedback-' + key);
                }
            }

            // go through all the tests associated to the category
            category['tests'].forEach(test => {
                // check if test is selected
                if ('selected' in test && test['selected'] && !checkedSections.includes(test['name'])) {
                    checkedSections.push(test['id']);
                    displayedSections.push(test['id']);
                    // if test's category was not selected, make sure it is displayed
                    if (!displayedSections.includes('feedback-' + key)){
                        displayedSections.push('feedback-' + key);
                    }
                }

                // unique test id must include category, test name and task id
                // for example:  readability-Use of Constants-03-01
                tests[test['id']] = test;

                // add test 'additional details'
                add_test_popup(test);

                // add test message
                add_test_messages(test, false);
            })

            // default categories (e.g., functionality) should always be treated as selected
            if (default_categories.includes(key)) {
                if (!checkedSections.includes('feedback-' + key)) {
                    checkedSections.push('feedback-' + key);
                    displayedSections.push('feedback-' + key);
                }
                category['tests'].forEach( test => {
                    if (!checkedSections.includes(test['id'])) {
                        checkedSections.push(test['id']);
                        displayedSections.push(test['id']);
                    }
                })
            }
        }
        // list of all checked categories and tests
        console.debug('checkedSections = %O', checkedSections);
        for (const sec in checkedSections) {
            console.debug('    %s', checkedSections[sec]);
        }

        // list of all displayed categories and tests
        console.debug('displayedSections = %O', displayedSections);
        for (const sec in displayedSections) {
            console.debug('    %s', displayedSections[sec]);
        }

        // set checkboxes
        var checkboxes = $("#feedbacks input[type='checkbox']");
        for (var i = 0; i < checkboxes.length; i++) {
            console.debug('checkboxes[%d] = %O', i, checkboxes[i].value);
            // selected category/test
            if (checkedSections.includes(checkboxes[i].value)) {
                // check category/test
                checkboxes[i].checked = true;

                // TODO not clear what this 'if' is meant to do...
                var category_name = "";
                if (checkboxes[i].value.startsWith("feedback-")) {
                    category_name = checkboxes[i].id.replace("checkBoxSelect-feedback-", "");
                } else {
                    category_name = checkboxes[i].closest('.displayed_feedback').id.replace("feedback-", "");
                }

                // default categories cannot be unselected
                if (default_categories.includes(category_name)) {
                    checkboxes[i].disabled = true;
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
        var href = window.location.origin + "/admin/" + courseid + "/submissions?download_submission=" + submissionid
        var download_btn = $(".download-btn");
        download_btn.attr('href', href);

        // set UI elements
        if (currentStep === 1) {
            // no 'back' from STEP 1
            disable_button("back", "true");
            
            // hide instructor comments and total feedback (will apear in STEP 2 & 3)
            $(".message").css("display", "none");

            // TODO consider droping this filter, since the failed/passsed criterion is only relevant 
            // to functionality tests
            // set test filter to all
            $('#select-btn').val('all');
            update_filter($('#select-btn')[0]);
        } else {
            // if inital step is 2 or 3, page is undated accordingly
            update_page(currentStep);
        }
    }

    // this function is called when we get back to a feedback page that was already displayed in 
    // the past
    // ---
    function update_page(currentStep) {
        console.debug('In function: update_page(%d)', currentStep);

        // load data from storafe
        try {
            load_from_storage();
        } catch (e) {
            console.log("there is nothing in storage");
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

        console.debug("page_categories = %O", page_categories);
        for (const cat in page_categories) {
            console.debug('    %s', page_categories[cat]['id']);
        }
        console.debug("page_tests = %O", page_tests);
        for (const tst in page_tests) {
             console.debug('    %s', page_tests[tst]['id']);
        }

        // STEP 1
        // ------
        if (currentStep === 1) {
            // hide submit/save buttons
            $("#submit-buttons")[0].style.display = 'none';

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

            // hide category and test checkboxes
            var checkboxes = $("#feedbacks input[type='checkbox']");
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'none';
            }

            // hide unselected  tests
            console.log("diplayedSections = %O", displayedSections);
            for (var i = 0; i < page_tests.length; i++) {
                if (!displayedSections.includes(page_tests[i].id)) {
                    page_tests[i].style.display = 'none';
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

        $('#select-btn').val(filter);
        update_filter($('#select-btn')[0]);
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
        console.debug('In function: add_test_messages(%O, %s)', test, is_draft);

        if (test['message']) {
            var messages = test['message'].split("\n");

            // TODO not clear why this is needed
            var extra_text = is_draft ? "test-" : "";

            // get test's taskid if any
            var taskid = 'taskid' in test ? (test['taskid'] ? test['taskid']: "None") : "";

            // insert message html
            messages.forEach(message => {
                message = message.replaceAll(/\"/g, '\\\"')
                var line = $('<p style="margin: 0"></p>');
                line.text(message);
                $("." + extra_text + taskid + test['name'].replace(/ /g, '') + "-message").append(line);
            })
        }
    }

    // this function creates the 'additional details' popup window for a test
    // ---
    function add_test_popup(test) {
        console.debug('In function: add_test_popup(%O)', test);
        console.debug('   %s', test['name']);

        if ((('cout_text' in test) && test['cout_text']) || (('cout_file' in test) && test['cout_file'])) {
            $("." + test['name'].replace(/ /g, '') + "-popup").css("display", "initial");
        }
    }

    // this function sets the display mode (flex = show, none = hide) for tests
    // ---
    function change_display_mode(test, mode) {
        console.debug('In function: change_display_mode(\n    %O,\n    %s)', test, mode);

        if (currentStep === 2) {
            // in STEP 2, a test is shown only if its parent category is shown
            if (displayedSections.includes(test.id)) {
                test.style.display = mode
            }
        } else {
            test.style.display = mode
        }
    }

    // this functions is called when a user changes the testqcategory filter
    // ---
    function update_filter(event) {
        console.debug('In function: update_filter(%s)', event.value);

        var value = event.value;
        filter = value;
        if (value === "passed") {
            // show only passed tests
            var passed_tests = $("div[data-result=passed]")
            for (var i = 0; i < passed_tests.length; i++){
                change_display_mode(passed_tests[i], "flex");
            }
            var failed_tests = $("div[data-result=failed]")
            for (var i = 0; i < failed_tests.length; i++){
                change_display_mode(failed_tests[i], "none");
            }
        } else if (value === "failed") {
            // show only failed tests
            var passed_tests = $("div[data-result=passed]")
            for (var i = 0; i < passed_tests.length; i++){
                change_display_mode(passed_tests[i], "none");
            }
            var failed_tests = $("div[data-result=failed]")
            for (var i = 0; i < failed_tests.length; i++){
                change_display_mode(failed_tests[i], "flex");
            }
        } else if (value == "all") {
            // show all tests
            var all_tests = $(".test-data")
            for (var i = 0; i < all_tests.length; i++){
                change_display_mode(all_tests[i], "flex");
            }
            var all_categories = $(".category")
            for (var i = 0; i < all_categories.length; i++){
                change_display_mode(all_categories[i], "flex");
            }
        } else {
            console.log('Unexpected filter event value = %s', value);
        }
    }

    // this functions updates the current step, and refreshes the page accordingly
    // ---
    function update_step(accumulator) {
        console.debug('In function: update_step(%d)', accumulator);

        // update curret step
        currentStep += accumulator;
        console.log('    currentStep = %d', currentStep);

        // save data
        save_to_storage();

        // update page with new step
        update_page(currentStep);
    }

    // this function is called when a user checks/unchecks a tests or category
    // ---
    function select_category_or_test(event) {
        console.debug('In function: select_category_or_test(%O)', event);
        console.log('    value   = %s', event.value);
        console.log('    checked = %s', event.checked);

        if (event.checked) {
            if (event.value.startsWith("feedback")) {
                // category checked - check all subsequent tests
                var checkboxes = $("#" + event.value + " input[type='checkbox']");
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = true;
                    checkedSections.push(checkboxes[i].value);
                    displayedSections.push(checkboxes[i].value);
                }
            } else {
                // test checked
                checkedSections.push(event.value);
                displayedSections.push(event.value);

                // make parent category visible
                var test_category = event.closest('.displayed_feedback');
                if (!displayedSections.includes(test_category.id)) {
                    displayedSections.push(test_category.id);
                }

                // category should be checked only if all subsequent tests are checked
                var category_children = $("#" + test_category.id + " .displayed_test_feedback");
                var flag = true
                for (var i = 0; i < category_children.length; i++) {
                    if (!checkedSections.includes(category_children[i].id)) {
                        flag = false
                    }
                }
                if (flag) {
                    var checkbox = $("#" + test_category.id + " input[type='checkbox']")[0];
                    checkbox.checked = true;
                    checkedSections.push(test_category.id)
                }
            }
        } else {
            if (event.value.startsWith("feedback")) {
                // category unchecked - uncheck all subsequent tests
                var checkboxes = $("#" + event.value + " input[type='checkbox']");
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = false;
                    checkedSections = checkedSections.filter(v => v !== checkboxes[i].value);
                    displayedSections = displayedSections.filter(v => v !== checkboxes[i].value);
                }
            } else {
                // test unchecked
                checkedSections = checkedSections.filter(v => v !== event.value);
                displayedSections = displayedSections.filter(v => v !== event.value);

                // uncheck parent category
                var test_category = event.closest('.displayed_feedback');
                var checkbox = $("#" + test_category.id + " input[type='checkbox']")[0];
                checkbox.checked = false;

                // if no test left selected, hide category
                checkedSections = checkedSections.filter(v => v !== test_category.id);
                var category_children = $("#" + test_category.id + " .displayed_test_feedback");
                var flag = false
                for (var i = 0; i < category_children.length; i++) {
                    if (displayedSections.includes(category_children[i].id)) {
                        flag = true
                    }
                }
                if (flag === false) {
                    displayedSections = displayedSections.filter(v => v !== test_category.id);
                }
            }
        }

        console.log('checkedSections = %O', checkedSections);
        console.log('displayedSections = %O', displayedSections);
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
        const test = tests[test_id];

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
                    url: window.location.origin + '/feedback/' + courseid + "/" + taskid + "/" + submissionid + '/cout?cout=' + test['cout_file'],
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
        var total_feedback = $("#total-feedback").val();

        // categories to save
        // TODO should be all categories
        var categories_for_save = {}
        for (const key in categories) {
            // save if category visible
            if (displayedSections.includes('feedback-' + key)) {
                categories_for_save[key] = JSON.parse(JSON.stringify(categories[key]));
            }
        }

        // console.debug('categories_for_save = %O', categories_for_save);

        // save instructor comments and selected tests, for each visible category
        for (const key in categories_for_save) {
            var category = categories_for_save[key]

            // instructor comments
            category['feedback'] = $("#message-feedback-" + key).val();

            // selected tests
            category['tests'] = category['tests'].filter(test =>
                displayedSections.includes(test['id'])
            )
        }

        // check if browser supports local storage
        if (typeof (Storage) !== "undefined") {
            // prepare data for saving
            var data = {
                "currentStep": currentStep,
                "checkedSections": checkedSections,
                "displayedSections": displayedSections,
                "feedback_draft": categories_for_save,
                "total_feedback": total_feedback,
                "current_filter": filter,
            };

            // save data
            localStorage.setItem(courseid + "/" + taskid + "/" + submissionid, JSON.stringify(data));
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function loads data from local storage
    // ---
    function load_from_storage() {
        console.debug('In function: load_from_storage()');

        // check if browser supports local storage
        if (typeof (Storage) !== "undefined") {
            // get data from local storage
            var data = localStorage[courseid + "/" + taskid + "/" + submissionid];
            data = JSON.parse(data);

            currentStep = data.currentStep ? data.currentStep : 1;
            checkedSections = data.checkedSections ? data.checkedSections : [];
            displayedSections = data.displayedSections ? data.displayedSections : [];
            draft_categories = sort_categories(data.feedback_draft) ? data.feedback_draft : [];
            total_feedback = data.total_feedback ? data.total_feedback : '';
            filter = data.current_filter ? data.current_filter : "failed";

            // restore instructor comments
            for (const key in draft_categories) {
                $("#message-feedback-" + key).val(draft_categories[key]['feedback']);
            }

            // restore summary feedback
            $("#total-feedback").val(total_feedback)
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function saves a draft of the feedback manager page
    // ---
    function save_draft() {
        console.debug('In function: save_draft()');

        // send save request
        send_save_request(categories,false);

        // save to local storage
        save_to_storage();
    }

    // this function saves a draft of the feedback manager page
    // ---
    function delete_draft() {
        console.debug('In function: delete_draft()');

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([courseid + "/" + taskid + "/" + submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function submits a final version of feedback
    // ---
    function submit() {
        console.debug('In function: submit()');

        // send save request
        send_save_request(categories, true);

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([courseid + "/" + taskid + "/" + submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function sends a request to save feedback in the database (draft or final)
    // ---
    function send_save_request(feedback, is_final_version) {
        console.debug('In function: send_save_request(%O, %s)', feedback, is_final_version);

        var feedback_categories = JSON.parse(JSON.stringify(feedback));
        var category;
        for (const key in feedback_categories) {
            category = feedback_categories[key]

            // instructor comments
            category['feedback'] = $("#message-feedback-" + key).val();

            // check if category is selected
            category['selected'] = checkedSections.includes("feedback-" + key);

            // category selected tests
            category['tests'].forEach(test => {
                    test['selected'] = checkedSections.includes(test['id']);
            });
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
                    "categories": feedback_categories,
                    "total_feedback": total_feedback,
                    "draft": !is_final_version,
                }),
                success: function(data) {
                    console.log("save: success");

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
                url: window.location.href + "/preview",
                contentType: 'application/json',
                data: JSON.stringify({
                    "categories": draft_categories,
                    "total_feedback": total_feedback,
                }),
                success: function(response) {
                    console.log("preview: success");

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
    function render_student_feedback(feedback_data, input_courseid, input_taskid, input_submissionid) {
        console.debug('In function: render_student_feedback(\n    %O,\n    %s,\n    %s,\n    %s)', 
                    feedback_data, input_courseid, input_taskid, input_submissionid);

        // get inputs
        courseid = input_courseid;
        taskid = input_taskid;
        submissionid = input_submissionid;

        // render summary feedback
        var total_feedback_data = "<None>";
        if (feedback_data['total_feedback']) {
            total_feedback_data = feedback_data['total_feedback']
        }
        var total_feedback = $(tmpl('tmpl-total-feedback', total_feedback_data));
        $('#scenarios-table').append(total_feedback);

        // render categories
        var category_section;
        var feedback_categories = sort_categories(feedback_data['categories']);
        for (const key in feedback_categories) {
            var category_data = feedback_categories[key]

            category_data["category"] = key
            category_section = $(tmpl('tmpl-category', category_data));
            $('#scenarios-table').append(category_section);

            // for default categories (e.g., functionality) set color based on status
            if (default_categories.includes(key)) {
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
                // for default categories (e.g., functionality) border color is set according to test result
                if (default_categories.includes(test['category'])) {
                    if (test['result']['text'] === 'passed') {
                        test["border_color"] = 'green';
                    } else if (test['result']['text'] === 'failed') {
                        test["border_color"] = 'red';
                    }
                }

                // add test box
                var test_section = $(tmpl('tmpl-test', test));
                $('#feedback-' + key + '-tests .test-container').append(test_section);

                // save test for further processing
                tests[test['id']] = test;

                // add test popup
                add_test_popup(test);

                // add test message
                add_test_messages(test, true);
            })

            // TODO don't know what this is
            $('.print-head').hide()
        };

        // TODO not sure what this is and why is it outside the loop
        if (feedback_data['draft'] === false) {
            var popup_section = $(tmpl('tmpl-popup', category_data));
            $('#scenarios-table').append(popup_section);
        }

        // refresh filter
        $('#select-btn').val(filter);
        update_filter($('#select-btn')[0]);
    }

    // this function sorts a list of categories: defualt categories first
    function sort_categories(feedback_categories) {
        console.debug('In function: sort_categories(%O)', feedback_categories);

        var keys = Object.keys(feedback_categories);
        keys.sort((k1, k2) => {
            // default category before non-default category
            if (default_categories.includes(k1) && !default_categories.includes(k2)) {
                return -1;
            } else if (!default_categories.includes(k1) && default_categories.includes(k2)) {
                return 1;
            } else if (default_categories.includes(k1) && default_categories.includes(k2)) {
                // default categories in the order they are defined
                return default_categories.indexOf(k1) < default_categories.indexOf(k2) ? -1 : 1;
            }
            // regular order for non-default categories
            return k1.localeCompare(k2);
        })

        // build sorted category list
        var sorted_categories = {};
        for (const key of keys) {
            sorted_categories[key] = feedback_categories[key];
        }
        return sorted_categories;
    }

    return {
        init_manage_feedback_page: init_manage_feedback_page,
        init_variables: init_variables,
        update_filter: update_filter,
        update_step: update_step,
        select_category_or_test: select_category_or_test,
        save_to_storage: save_to_storage,
        load_from_storage: load_from_storage,
        save_draft: save_draft,
        submit: submit,
        open_popup: open_popup,
        close_popup: close_popup,
        render_student_feedback: render_student_feedback
    }

})(jQuery);
