/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var g_task_code = {};
var g_codemirror;
var g_editor;

var FeedbackPlugin = (function () {
    // Grade categories are always treated as if they are selected, along with their tests.
    const g_grade_categories = ['functionality'];

    // Global variables for data stored in local storage
    var g_feedback_categories = [];
    var g_feedback_summary = "";

    var g_courseid = "";
    var g_taskid = "";
    var g_submissionid = "";
    var g_student = "";
    var g_submission_url = "";
    var g_staff = true;
    var g_current_step = 1;

    // this function is called from feedback_manager.html
    // ---
    function init_manage_feedback_page(input_courseid, input_taskid, input_submissionid, input_student, staff, input_submission_url, database_feedback) {
        console.debug('In function: init_manage_feedback_page(%O, %s)', database_feedback, staff);

        g_courseid = input_courseid;
        g_taskid = input_taskid;
        g_submissionid = input_submissionid;
        g_student = input_student;
        g_submission_url = input_submission_url;
        g_staff = true ? staff == 'True' : false;
        g_current_step = 1;
    
        console.debug('==========');

        // get feedback data from storage, or fronm database if not there
        try {
            load_from_storage();
            console.debug('Initial data from storage = %O', g_feedback_categories);
        } catch (e) {
            g_feedback_summary = database_feedback['feedback_summary'];
            g_feedback_categories = database_feedback['categories'];
            for (const cat in g_feedback_categories) {
                g_feedback_categories[cat]['tests'].forEach(test => {
                    // set UI id
                    test['ui_id'] = test['category'] + '-' + test['taskid'] + '-' + test['id'];

                    // Force selection of grade category (e.g., functionality) tests
                    if (g_grade_categories.includes(test['category'])) {
                        test['selected'] = true
                    }
                })
            }    
            save_to_storage();
            console.debug('Initial data from database = %O', g_feedback_categories);
        }
        
        // set UI elements

        // set feedback summary element
        $("#total-feedback").val(g_feedback_summary)

        for (const cat in g_feedback_categories) {
            // cat is the category name, in English. For example, coding, design...
            var category = g_feedback_categories[cat];

            // set category instructor message in UI
            if (category['feedback'] && category['feedback'].length > 0) {
                $("#message-feedback-" + cat).val(category['feedback']);
            }

            // set tests associated with the category
            var all_tests_selected = true;
            category['tests'].forEach(test => {
                var test_name = document.getElementsByClassName(test['ui_id'] + '-name')[0];
                var test_message = document.getElementsByClassName(test['ui_id'] + '-message')[0];

                // set click handler
                var test_boxes = document.getElementsByClassName(test['taskid']);
                [...test_boxes].forEach(box => {
                    box.addEventListener('click', set_task_code, false);
                });

                // set test name and message
                test_name.innerHTML = test['name'];
                test_message.innerHTML = test['message'];

                // add test 'additional details'
                add_test_popup(test);

                // add test message
                add_test_messages(test, true);
       
                // selected category/test
                if (test['selected'] || g_grade_categories.includes(cat)) {
                    var test_checkbox_element = document.getElementById('checkBoxSelect-' + test['ui_id']);
                    
                    // check category/test
                    test_checkbox_element.checked = true;

                    // default categories cannot be unselected
                    if (g_grade_categories.includes(cat)) {
                        test_checkbox_element.disabled = true;
                    }
                } else {
                    all_tests_selected = false;
                }
            })
        }

        // set 'download' button
        var href = window.location.origin + "/admin/" + g_courseid + "/submissions?download_submission=" + g_submissionid
        var download_btn = $(".download-btn");
        download_btn.attr('href', href);

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

        var mode = CodeMirror.findModeByName('C');
        g_codemirror = document.getElementsByClassName('codemirror-textarea')[0];
        g_editor = CodeMirror.fromTextArea(g_codemirror, {
            lineNumbers: true,
            mode: mode['mime'],
            indentUnit: 4,
            readOnly: true
        });
        CodeMirror.autoLoadMode(g_editor, mode["mode"]);
        }

    function update_step(step) {
        var next_btn = document.getElementById("next");
        var prev_btn = document.getElementById("prev");

        g_current_step = g_current_step + step;
        console.log("current step = %d", g_current_step);
        if (g_current_step == 1) {
            // STEP 1
            next_btn.disabled = false;
            next_btn.classList.remove("disabled");
            prev_btn.disabled = true;
            prev_btn.classList.add("disabled");
        }
        else if (g_current_step == 2) {
            // STEP 2
            next_btn.disabled = true;
            next_btn.classList.add("disabled");
            prev_btn.disabled = false;
            prev_btn.classList.remove("disabled");
        }
        else {
            console.error("unexpected current step = %d", g_current_step);
        }
        
    }

    // this function changes the disable status of buttons (true/false), with a given name
    // for example: next_btn, back_btn.
    // ---
    function disable_button(btn, value) {
        console.debug('In function: disable_button(%s, %s)', btn, value);

        var buttons = $("." + btn + "_btn");
        [...buttons].forEach(button => {
            button.disabled = value;
        })
    }

    // this function adds the message of a test
    // ---
    function add_test_messages(test) {
        // console.debug('In function: add_test_messages(%s, %s)', test['message'], is_draft);
        
        // set test name
        $("." + test['ui_id'] + "-name").innerHTML = test['name'];       

        // set test code
        var codeSelector = document.getElementById("codeSectionSelector");
        if (test['category'] == 'functionality' && !(test['taskid'] in g_task_code)) {
            var option = document.createElement("option");
            option.text = test['taskid'];
            codeSelector.add(option);    
            
            if ('code' in test) {
                g_task_code[test['taskid']] = test['code'];
            }
            else {
                g_task_code[test['taskid']] = 'לא נמצא קוד לתרגיל זה בבסיס הנתונים';
            }
        }
    }

    // this function creates the 'additional details' button
    // ---
    function add_test_popup(test) {
        // console.debug('In function: add_test_popup(%O)', test);

        if ((('cout_text' in test) && test['cout_text'] != 'N/A') || (('cout_file' in test) && test['cout_file'])) {
            $("." + test['ui_id'] + "-popup").css("display", "initial");
        }
    }

    // this function is called when a user checks/unchecks a tests or category
    // ---
    function select_category_or_test(event) {
        console.debug('In function: select_category_or_test(%O)', event);
        console.log('    value   = %s', event.value);
        console.log('    checked = %s', event.checked);

        if (event.value.startsWith("feedback")) {
            // Category checkbox event - check/uncheck all associated tests
            var checkboxes = $("#" + event.value + " input[type='checkbox']");
            [...checkboxes].forEach(checkbox => {
                checkbox.checked = event.checked;
            })
        } else {
            // Test checkbox event
            var test_category = event.closest('.displayed_feedback');
            var test_category_checkbox = $("#" + test_category.id + " input[type='checkbox']")[0];

            if (event.checked) {                
                // if all tests are checked - check category
                var all_tests_selected = true
                var checkboxes = $("#" + test_category_checkbox.value + " input[type='checkbox']");
                [...checkboxes].forEach(checkbox => {
                    if (!checkbox.value.startsWith("feedback") && !checkbox.checked) {
                        all_tests_selected = false;
                    }
                });        
                test_category_checkbox.checked = all_tests_selected;    
            } else {
                // uncheck parent category
                test_category_checkbox.checked = false;
            }
        }

        // update test selection 
        for (const c in g_feedback_categories) {
            var category = g_feedback_categories[c];
            category['tests'].forEach(test => {
                var test_checkbox = $("#" + "checkBoxSelect-" + test['ui_id'])[0];

                test['selected'] = test_checkbox.checked;
            });
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
        const test_id = event.classList[0].split('-popup')[0];
        var test = get_test_from_element_id(test_id);
        var cout_text = test['cout_text'] || "";

        // get test cout 
        var line;
        cout_text.split("\n").forEach(text => {
            line = $('<li></li>');
            line.text(text);
            $("#popup-text").append(line);
        })

        // display additional details popup
        $("#popup").css("display", "initial");
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

        // local storage is only used for instructors
        if (!g_staff) {
            return;
        }

        // check if browser supports local storage
        if (typeof (Storage) !== "undefined") {
            // save version for debug purposes
            var footer_element = document.getElementById("footer");
            var version =  footer_element.innerHTML.split('INGInious ')[1].split(' ')[0];

            // prepare data for saving
            var data = {
                "g_feedback_categories": g_feedback_categories,
                "g_feedback_summary": g_feedback_summary,
                "saveTime": new Date().toLocaleString(),
                "saveVersion": version
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

            g_feedback_categories = data.g_feedback_categories ? data.g_feedback_categories : [];
            g_feedback_summary = data.g_feedback_summary ? data.g_feedback_summary : '';

            console.debug('load_from_storage %O', data);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function saves a draft of the feedback manager page
    // ---
    function save_draft() {
        console.debug('In function: save_draft()');

        // send save request
        send_save_request(false);

        // save to local storage
        save_to_storage();
    }

    // this function submits a final version of feedback
    // ---
    function submit() {
        console.debug('In function: submit()');

        // send save request
        send_save_request(true);

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([g_submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function sends a request to save feedback in the database (draft or final)
    // ---
    function send_save_request(is_draft) {
        console.debug('In function: send_save_request(%s)', is_draft);

        // save version for debug purposes
        var footer_element = document.getElementById("footer");
        var version =  footer_element.innerHTML.split('INGInious ')[1].split(' ')[0];
        
        console.debug("g_feedback_categories = %O", g_feedback_categories);
        // send save request
        var error_message = "";
        $.ajax({
                type: "POST",
                url: window.location.href + "?submit=" + is_draft,
                contentType: 'application/json',
                data: JSON.stringify({
                    "categories": g_feedback_categories,
                    "feedback_summary": g_feedback_summary,
                    "saveTime": new Date().toLocaleString(),
                    "saveVersion": version
                }),
                success: function(data) {
                    console.log("save: success");

                    // display message to user
                    var message = is_draft ? "Feedback draft was saved for student " + g_student : "Final feedback was submitted for student " + g_student;
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
        let siblings = event.parentElement.children;
        for (var i = 0; i < siblings.length; i++) {
            var el = siblings[i];
            console.log("el = %O", el);
            if (el.type == 'button' && el.classList) {
                if (el.classList.contains("edit_btn")) {
                    el.disabled = true;
                    el.classList.add("disabled");
                }
                else if (el.classList.contains("cancel_btn")) {
                    el.disabled = false;
                    el.classList.remove("disabled");
                }
                else if (el.classList.contains("save_btn")) {
                    el.disabled = false;
                    el.classList.remove("disabled");
                }
            }
        };
        
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
        var test = get_test_from_element_id(event.value);

        // update buttons state
        let siblings = event.parentElement.children;
        for (var i = 0; i < siblings.length; i++) {
            var el = siblings[i];
            console.log("el = %O", el);
            if (el.type == 'button' && el.classList) {
                if (el.classList.contains("edit_btn")) {
                    el.disabled = false;
                    el.classList.remove("disabled");
                }
                else if (el.classList.contains("cancel_btn")) {
                    el.disabled = true;
                    el.classList.add("disabled");
                }
                else if (el.classList.contains("save_btn")) {
                    el.disabled = true;
                    el.classList.add("disabled");
                }
            }
        };
        
        test_name.removeAttribute("original_text");
        test_message.removeAttribute("original_text");

        test['name'] = test_name.innerHTML;
        test['message'] = test_message.innerHTML;

        save_to_storage();
        
        test_name.removeAttribute("contenteditable");
        test_message.removeAttribute("contenteditable");

        document.activeElement.blur();
    }

    function cancel_edit(event) {
        console.log("cancel_edit - %O", event);

        var test_name = document.getElementsByClassName(event.value + '-name')[0];
        var test_message = document.getElementsByClassName(event.value + '-message')[0];

        // update buttons state
        let siblings = event.parentElement.children;
        for (var i = 0; i < siblings.length; i++) {
            var el = siblings[i];
            console.log("el = %O", el);
            if (el.type == 'button' && el.classList) {
                if (el.classList.contains("edit_btn")) {
                    el.disabled = false;
                    el.classList.remove("disabled");
                }
                else if (el.classList.contains("cancel_btn")) {
                    el.disabled = true;
                    el.classList.add("disabled");
                }
                else if (el.classList.contains("save_btn")) {
                    el.disabled = true;
                    el.classList.add("disabled");
                }
            }
        };

        test_name.innerHTML = test_name.getAttribute("original_text");
        test_message.innerHTML = test_message.getAttribute("original_text");

        test_name.removeAttribute("original_text");
        test_message.removeAttribute("original_text");

        test_name.removeAttribute("contenteditable");
        test_message.removeAttribute("contenteditable");
 
        document.activeElement.blur();
    }

    //
    function get_test_from_element_id(element_id) {
        var element = null;
        for (const c in g_feedback_categories) {
            g_feedback_categories[c]['tests'].forEach(test => {
                if (test['ui_id'] == element_id) {
                    element = test;
                }
            });
        }
        return element;
    }

    //
    function set_task_code() {
        const codeSelector = document.getElementById('codeSectionSelector');
        const codeContent = document.getElementById('codeContent');     
        var taskid = this.classList[0];

        codeSelector.value = taskid;
        g_editor.setValue(g_task_code[taskid], -1);
    }

    /**
     * Show and hide the section when click on dropdown button
     * @param header: the header on which we click
     */
    function task_dropdown(header) {
        const content_div = $(header).siblings(".content");
        const button = $(header).children(".dropdown_button");

        if ($(button).hasClass("fa-caret-down")) {
            $(button).removeClass("fa-caret-down").addClass("fa-caret-left");
            content_div.slideUp('fast')
        } else {
            $(button).removeClass("fa-caret-left").addClass("fa-caret-down");
            content_div.slideDown('fast')
        }
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
        cancel_edit: cancel_edit,
        task_dropdown: task_dropdown
    }

})(jQuery);

// Roi's SPlit table changes
document.addEventListener('DOMContentLoaded', () => {
    const codeSectionSelector = document.getElementById('codeSectionSelector');
    const leftPanel = document.getElementById('leftPanel');
    const codeViewer = document.getElementById('codeViewer');
    const divider = document.getElementById('divider');
    const showCodeButton = document.getElementById('showCodeButton');

    console.log(codeSectionSelector);
    // Change Code Viewer content based on dropdown selection
    codeSectionSelector.addEventListener('change', () => {
        g_editor.setValue(g_task_code[codeSectionSelector.value], -1);
    });

    // Show the Code Viewer when the button is clicked
    showCodeButton.addEventListener('click', () => {
        codeViewer.style.display = 'flex'; // Show code viewer
        showCodeButton.style.display = 'none'; // Hide the show button when viewer is visible

        // set initial value
        var codeSelector = document.getElementById("codeSectionSelector");
        g_editor.setValue(g_task_code[codeSelector.value], -1);
    });

    // Close the Code Viewer
    closeCodeViewer.addEventListener('click', () => {
        codeViewer.style.display = 'none'; // Hide code viewer
        showCodeButton.style.display = 'block'; // Show the circular button again
    });
    
    // Handle resizing between left panel and code viewer
    let isResizing = false;
    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = document.querySelector('.container').getBoundingClientRect();
        const newLeftPanelWidth = e.pageX - containerRect.left;

        // Ensure minimum widths for both panels
        if (newLeftPanelWidth > 150 && newLeftPanelWidth < containerRect.width - 150) {
            leftPanel.style.width = newLeftPanelWidth + 'px';
            codeViewer.style.width = containerRect.width - newLeftPanelWidth - 10 + 'px'; // -10px for padding
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
    
    
    // Editable text behavior
    const editButtons = document.querySelectorAll('.edit-btn');
    const saveButtons = document.querySelectorAll('.save-btn');
    const feedback_texts = document.querySelectorAll('.feedback-text');
    const editAreas = document.querySelectorAll('.edit-area');

    editButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            editAreas[index].value = feedback_texts[index].textContent.trim();   // Copy the current text into the textarea
            feedback_texts[index].style.display = 'none';                        // Hide the text
            editAreas[index].style.display = 'block';                            // Show the textarea
            editButtons[index].style.display = 'none';                           // Hide edit button
            saveButtons[index].style.display = 'block';                          // Show save button
        });
    });

    saveButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            feedback_texts[index].textContent = editAreas[index].value;          // Update the text with the value from textarea
            feedback_texts[index].style.display = 'block';                       // Show the updated text
            editAreas[index].style.display = 'none';                             // Hide the textarea
            editButtons[index].style.display = 'block';                          // Show edit button again
            saveButtons[index].style.display = 'none';                           // Hide save button
        });
    });
});