/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */

const CODE_SELECTOR_ID = "codeSectionSelector";
const LEFT_PANEL_ID = 'leftPanel';

var g_task_code = {};
var g_codemirror_element;
var g_editor;
var g_current_taskid = "";

var FeedbackPlugin = (function () {
    // Grade categories are always treated as if they are selected, along with their tests.
    const g_grade_categories = ['functionality'];

    // Global variables for data stored in local storage
    var g_feedback_categories = [];
    var g_feedback_summary = "";

    var g_courseid = "";
    var g_taskid = "";
    var g_feedback_mode = "";
    var g_submissionid = "";
    var g_student = "";
    var g_submission_url = "";
    var g_staff = true;
    var g_current_step = 1;

    // this function is called when feedback_manager.html is loaded
    // ---
    function init_manage_feedback_page(
        input_courseid, 
        input_taskid, 
        input_feedback_mode,
        input_submissionid, 
        input_student, 
        staff, 
        input_submission_url, 
        database_feedback) {

        console.debug('In function: init_manage_feedback_page(%O, %s)', database_feedback, staff);

        g_courseid = input_courseid;
        g_taskid = input_taskid;
        g_feedback_mode = input_feedback_mode
        g_submissionid = input_submissionid;
        g_student = input_student;
        g_submission_url = input_submission_url;
        g_staff = true ? staff == 'True' : false;
        if (g_staff) {
            g_current_step = 1;
        } else {
            g_current_step = 3;
        }
    
        console.debug('==========');

        // load submission data
        try {
            // load data from local storage (if exists)
            load_from_storage();
            console.debug('Initial data from storage = %O', g_feedback_categories);
        } catch (e) {
            // load initial data from submission
            g_feedback_summary = database_feedback['feedback_summary'];
            g_feedback_categories = database_feedback['categories'];
            
            for (const cat in g_feedback_categories) {
                var test_num = 1;
                g_feedback_categories[cat]['tests'].forEach(test => {
                    // set test UI id
                    test['element'] = test['category'] + '-' + test['taskid'] + '-' + String(test_num);
                    test_num++;

                    // Force selection of grade category (e.g., functionality) tests
                    if (g_grade_categories.includes(test['category'])) {
                        test['selected'] = true
                    }
                })
            }    
            save_to_storage();
            console.debug('Initial data from submission = %O', g_feedback_categories);
        }
        
        // set categories and tests
        var codeSelector_element = document.getElementById(CODE_SELECTOR_ID);
        for (const cat in g_feedback_categories) {
            // cat is the category name, in English. For example, coding, design...
            var category = g_feedback_categories[cat];

            // set tests associated with the category
            category['tests'].forEach(test => {
                var test_name_element = document.getElementsByClassName(test['element'] + '-name')[0];
                var test_message_element = document.getElementsByClassName(test['element'] + '-message')[0];

                // set test name and message
                test_name_element.innerHTML = test['name'];
                test_message_element.innerHTML = test['message'];

                // add test 'additional details'
                if (('cout_text' in test) && (test['cout_text'] != 'N/A')) {
                    $("." + test['element'] + "-popup").css("display", "initial");
                }

                // add test code
                if (test['category'] == 'functionality' && !(test['taskid'] in g_task_code)) {                    
                    if ('code' in test) {
                        g_task_code[test['taskid']] = test['code'];
                    }
                    else {
                        g_task_code[test['taskid']] = 'לא נמצא קוד לתרגיל זה בבסיס הנתונים';
                    }
                }
       
                // check selected tests
                if (test['selected']) {
                    var test_checkbox_element = document.getElementById('checkBoxSelect-' + test['element']);
                    
                    // check category/test
                    test_checkbox_element.checked = true;

                    // default categories cannot be unselected
                    if (g_grade_categories.includes(cat)) {
                        test_checkbox_element.disabled = true;
                    }
                }
            })
        }

        // set code mirror
        var mode = CodeMirror.findModeByName('C');
        g_codemirror_element = document.getElementsByClassName('codemirror-textarea')[0];
        g_editor = CodeMirror.fromTextArea(
            g_codemirror_element, {
                lineNumbers: true,
                mode: mode['mime'],
                indentUnit: 4,
                readOnly: true
            }
        );
        CodeMirror.autoLoadMode(g_editor, mode["mode"]);
        
        // set feedback summary element
        $("#top-total-feedback").val(g_feedback_summary)
        $("#bottom-total-feedback").val(g_feedback_summary)

        // set 'download' button
        // TODO check the functionality of this button
        var href = window.location.origin + "/admin/" + g_courseid + "/submissions?download_submission=" + g_submissionid
        var download_element = $(".download-btn");
        download_element.attr('href', href);

        // set 'next student' button functionality
        var next_student_element = $(".next-student-btn");
        next_student_element.click(function() {
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
                        display_user_message("No more students made submission for this course", "", "danger", true);
                    }
                },
                error: function (e) {
                    console.log("next: " + e.toString())
                },
            });
        })

        // set 'previous student' button functionality
        var previous_student_element = $(".previous-student-btn");
        previous_student_element.click(function() {
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
                        display_user_message("No more students made submission for this course", "", "danger", true);
                    }
                },
                error: function (e) {
                    console.log("prev: " + e.toString())
                },
            });
        })

        // select initial taskid
        console.log('g_feedback_categories = %O', g_feedback_categories);
        var initial_taskid;
        if ('current_taskid' in g_feedback_categories['functionality']) {
            initial_taskid = g_feedback_categories['functionality']['current_taskid'];
        }
        else {
            initial_taskid = g_feedback_categories['functionality']['tests'][0]['taskid'];
        }
        var taskid_element = document.getElementById(initial_taskid);
        taskid_element.click();

        // check for open categories
        for (const cat in g_feedback_categories) {
            if ('is_open' in g_feedback_categories[cat] && g_feedback_categories[cat]['is_open']) {
                var dropdown_btn = document.getElementById(`${cat}-dropdown-btn`)
                dropdown_btn.click();
            }
        }
        
        update_step(0);
    }

    // This function is called when moving between steps (previous/next)
    function update_step(step) {
        var container_element = document.getElementById("leftPanel");
        var next_element = document.getElementById("next");
        var previous_element = document.getElementById("prev");
        var preview_element = document.getElementById("preview");
        var save_feedback_element = document.getElementById("saveFeedback");
        var submit_feedback_element = document.getElementById("submitFeedback");
        var checkbox_elements = $("input[type='checkbox']")
        var top_summary_feedback = document.getElementById("top-total-feedback");
        var bottom_summary_feedback = document.getElementById("bottom-total-feedback");
        var top_summary_feedback_label = document.getElementById('top-total-feedback-label');
        var task_tab_elements = document.getElementById("task-tabs").children;
        var category_name_elements = document.getElementsByClassName("category-name");
        var student_view_title_element = document.getElementById("student-view-title");

        g_current_step = g_current_step + step;
        
        if (g_current_step == 1) {
            // STEP 1
            student_view_title_element.style.display = 'none';
            // buttons
            next_element.style.display = 'initial';
            preview_element.style.display = 'none';

            previous_element.disabled = true;
            previous_element.classList.add("disabled");          

            save_feedback_element.disabled = true;
            save_feedback_element.classList.add("disabled");
            submit_feedback_element.disabled = true;
            submit_feedback_element.classList.add("disabled");
            
            top_summary_feedback.style.display = 'none';
            bottom_summary_feedback.style.display = 'none';
            top_summary_feedback_label.style.display = 'none';

            [...task_tab_elements].forEach(task_tab_element => {
                task_tab_element.disabled = false;
                if (task_tab_element.id == g_current_taskid) {
                    task_tab_element.style.color = 'white';
                    task_tab_element.style.background = 'black';
                } else {
                    task_tab_element.style.color = 'black';
                    task_tab_element.style.background = 'white';
                }
                task_tab_element.style.border = 'solid 1px #ccc';
            });

            // selected counter
            [...category_name_elements].forEach(category_name_element => {
                var selected_count = 0;
                [...checkbox_elements].forEach(checkbox_element => {
                    if (checkbox_element.checked && checkbox_element.value.startsWith(category_name_element.id) &&
                        checkbox_element.dataset.taskid == g_current_taskid)
                        selected_count++;
                });
                    category_name_element.innerHTML = category_name_element.innerHTML.split('(')[0] + '(' + selected_count + ')'
            });            
            
            // checkboxes
            [...checkbox_elements].forEach(checkbox_element => {
                checkbox_element.style.display = 'inline-block';

                var test_element = document.getElementById(checkbox_element.value);
                var test_name_element = document.getElementsByClassName(checkbox_element.value + '-name')[0];
                var test = get_test_from_element_id(checkbox_element.value);

                if (checkbox_element.dataset.taskid == g_current_taskid) {
                    test_name_element.innerHTML = test['name'];
                    test_element.style.display = 'flex';
                } else {
                    test_element.style.display = 'none';
                }
            });
        }
        else if (g_current_step == 2) {
            // STEP 2
            student_view_title_element.style.display = 'none';
            container_element.style.background = 'none';
            // buttons
            next_element.style.display = 'none';
            preview_element.style.display = 'initial';

            previous_element.disabled = false;
            previous_element.classList.remove("disabled");
            save_feedback_element.disabled = false;
            save_feedback_element.classList.remove("disabled");
            submit_feedback_element.disabled = false;
            submit_feedback_element.classList.remove("disabled");

            
            top_summary_feedback.style.display = 'none';
            bottom_summary_feedback.style.display = 'initial';
            top_summary_feedback_label.style.display = 'none';
            
            // [...task_tab_elements].forEach(task_tab_element => {
            //     task_tab_element.disabled = true;
            //     task_tab_element.style.color = 'white';
            //     task_tab_element.style.background = 'white';
            //     task_tab_element.style.border = 'none';
            // });


            for (let element of document.getElementsByClassName("edit_btn")){
                element.style.display="initial";
             }
             for (let element of document.getElementsByClassName("save_btn")){
                element.style.display="initial";
             }
             for (let element of document.getElementsByClassName("cancel_btn")){
                element.style.display="initial";
             }

            // selected counter
            [...category_name_elements].forEach(category_name_element => {
                var selected_count = 0;
                [...checkbox_elements].forEach(checkbox_element => {
                    if (checkbox_element.checked && checkbox_element.value.startsWith(category_name_element.id))
                        selected_count++;
                });
                    category_name_element.innerHTML = category_name_element.innerHTML.split('(')[0] + '(' + selected_count + ')'
            });

            // checkboxes
            [...checkbox_elements].forEach(checkbox_element => {
                var test_element = document.getElementById(checkbox_element.value);
                var test_name_element = document.getElementsByClassName(checkbox_element.value + '-name')[0];
                var test = get_test_from_element_id(checkbox_element.value);
                if (checkbox_element.checked) {
                    test_element.style.display = 'flex';
                    test_name_element.innerHTML = test['taskid'] + ': ' + test['name'];
                    checkbox_element.style.display = 'initial';
                }
                else {
                    test_element.style.display = 'none';
                }
            });
        }
        else if (g_current_step == 3) {
            // STEP 3
            if (g_staff) {
                student_view_title_element.style.display = 'initial';
                container_element.style.background = 'aliceblue';
                next_element.style.display = 'none';
                previous_element.style.display = 'initial';
                preview_element.style.display = 'none';
            } else {
                student_view_title_element.style.display = 'none';
                container_element.style.background = 'white';
                var nav_btns = document.getElementsByClassName('nav-buttons')[0];
                nav_btns.style.display = 'none';
                var sidebar = document.getElementById('fm-sidebar');
                sidebar.style.display = 'none';
            }

            // buttons

            submit_feedback_element.disabled = false;
            submit_feedback_element.classList.remove("disabled");

            top_summary_feedback.value = bottom_summary_feedback.value;
            top_summary_feedback.style.display = 'initial';
            bottom_summary_feedback.style.display = 'none';
            top_summary_feedback_label.style.display = 'initial';

            // [...task_tab_elements].forEach(task_tab_element => {
            //     task_tab_element.disabled = true;
            //     task_tab_element.style.color = 'white';
            //     task_tab_element.style.background = 'white';
            //     task_tab_element.style.border = 'none';
            // });

            [...category_name_elements].forEach(category_name_element => {
                category_name_element.innerHTML = category_name_element.innerHTML.split('(')[0];
                if (category_name_element.id == 'functionality') {
                    
                } else {
                    
                }
            });

            // categories    
            for (var cat in g_feedback_categories) {
                var category_element = document.getElementById('feedback-' + cat + '-data');
                var category_btn_element = document.getElementById(cat + '-dropdown-btn');

                if (cat == 'functionality') {
                    category_element.style.display = 'none';
                    if (category_btn_element.classList.contains("fa-caret-down")) {
                        category_btn_element.classList.remove("fa-caret-down")
                        category_btn_element.classList.add("fa-caret-right");
                    }
                } else {
                    category_element.style.display = 'flex';
                    if (category_btn_element.classList.contains("fa-caret-right")) {
                        category_btn_element.classList.remove("fa-caret-right")
                        category_btn_element.classList.add("fa-caret-down");
                    }
                }
            }

            for (let element of document.getElementsByClassName("edit_btn")){
                element.style.display="none";
             }
             for (let element of document.getElementsByClassName("save_btn")){
                element.style.display="none";
             }
             for (let element of document.getElementsByClassName("cancel_btn")){
                element.style.display="none";
             }


            // checkboxes
            [...checkbox_elements].forEach(checkbox_element => {
                var test_element = document.getElementById(checkbox_element.value);
                var test_name_element = document.getElementsByClassName(checkbox_element.value + '-name')[0];
                var test = get_test_from_element_id(checkbox_element.value);

                if (checkbox_element.checked) {
                    test_element.style.display = 'flex';
                    test_name_element.innerHTML = test['taskid'] + ': ' + test['name'];
                    checkbox_element.style.display = 'none';
                }
                else {
                    test_element.style.display = 'none';
                }
            });
            
        }
        else {
            console.error("unexpected current step = %d", g_current_step);
        }

    }

    // this function is called when a user checks/unchecks a test
    // ---
    function test_checkbox_handler() {
        // update all tests, based on checkboxes
        for (const c in g_feedback_categories) {
            var category = g_feedback_categories[c];
            category['tests'].forEach(test => {
                var test_checkbox = $("#" + "checkBoxSelect-" + test['element'])[0];

                test['selected'] = test_checkbox.checked;
            });
        }
        save_to_storage();
        update_step(0);
    }

    // this function is called when the 'additional details' button is pressed
    // for a specific tests. it prepares the cout text and shows it in a popup.
    // ---
    function additional_info_open_handler(event) {
        // find associated test
        const test_id = event.classList[0].split('-popup')[0];
        var test = get_test_from_element_id(test_id);
        var modal = document.getElementsByClassName('test-modal')[0];
        var cout_text = test['cout_text'] || "";

        // get test cout 
        $("#popup-text").empty();
        var line;
        cout_text.split("\n").forEach(text => {
            line = $('<li></li>');
            line.text(text);
            $("#popup-text").append(line);
        })

        // display additional details popup      
        modal.show();
        document.activeElement.blur();
    }
    
    // this function closes the popup window.
    // ---
    function additional_info_close_handler (event) {
        var modal = document.getElementsByClassName('test-modal')[0];

        modal.close();
    }

    // Handlers for test edit buttons
    function test_remove_handler(event) {
        console.log("test_remove_handler - %O", event);

        document.body.style.cursor = 'progress';

        var category = event.dataset.category;
        var test_id = event.dataset.testid;

        for(var i = 0; i < g_feedback_categories[category]['tests'].length; i++){
            if (g_feedback_categories[category]['tests'][i]['id'] == test_id) {
                break;
            }
        }
        g_feedback_categories[category]['tests'].splice(i, 1);

        for (cat in g_feedback_categories) {
            g_feedback_categories[cat]['is_open'] = false;
        }
        g_feedback_categories[category]['is_open'] = true;
        g_feedback_categories['functionality']['current_taskid'] = g_current_taskid;
        send_save_request(is_draft=true, show_message=false);

        // if saved in local storge, remove draft to force reload from database
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([g_submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }

        setTimeout(() => {
            location.reload();
        }, 3000);   
        // document.body.style.cursor = 'default';    



    }

    function test_edit_handler(event) {
        console.log("test_edit_handler - %O", event);

        // update buttons state
        let siblings = event.parentElement.children;
        for (var i = 0; i < siblings.length; i++) {
            var element = siblings[i];
            
            if (element.type == 'button' && element.classList) {
                if (element.classList.contains("edit_btn")) {
                    element.disabled = true;
                    element.classList.add("disabled");
                }
                else if (element.classList.contains("cancel_btn")) {
                    element.disabled = false;
                    element.classList.remove("disabled");
                }
                else if (element.classList.contains("save_btn")) {
                    element.disabled = false;
                    element.classList.remove("disabled");
                }
            }
        };
        
        // make name and message editable
        var test_name_element = document.getElementsByClassName(event.value + '-name')[0];
        var test_message_element = document.getElementsByClassName(event.value + '-message')[0];
        
        test_name_element.setAttribute("contenteditable", "true");
        test_name_element.setAttribute("original_text", test_name_element.innerHTML);

        test_message_element.setAttribute("contenteditable", "true");
        test_message_element.setAttribute("original_text", test_message_element.innerHTML);

        // set focus to message
        test_message_element.focus();
    }

    function test_edit_save_handler(event) {
        console.log("test_edit_save_handler - %O", event);

        var test_name_element = document.getElementsByClassName(event.value + '-name')[0];
        var test_message_element = document.getElementsByClassName(event.value + '-message')[0];
        var test = get_test_from_element_id(event.value);

        // update buttons state
        let siblings = event.parentElement.children;
        for (var i = 0; i < siblings.length; i++) {
            var element = siblings[i];
            console.log("el = %O", element);
            if (element.type == 'button' && element.classList) {
                if (element.classList.contains("edit_btn")) {
                    element.disabled = false;
                    element.classList.remove("disabled");
                }
                else if (element.classList.contains("cancel_btn")) {
                    element.disabled = true;
                    element.classList.add("disabled");
                }
                else if (element.classList.contains("save_btn")) {
                    element.disabled = true;
                    element.classList.add("disabled");
                }
            }
        };
        
        test_name_element.removeAttribute("original_text");
        test_message_element.removeAttribute("original_text");

        test['name'] = test_name_element.innerHTML;
        test['message'] = test_message_element.innerHTML;

        save_to_storage();
        
        test_name_element.removeAttribute("contenteditable");
        test_message_element.removeAttribute("contenteditable");

        document.activeElement.blur();
    }

    function test_edit_cancel_handler(event) {
        console.log("test_edit_cancel_handler - %O", event);

        var test_name_element = document.getElementsByClassName(event.value + '-name')[0];
        var test_message_element = document.getElementsByClassName(event.value + '-message')[0];

        // update buttons state
        let siblings = event.parentElement.children;
        for (var i = 0; i < siblings.length; i++) {
            var element = siblings[i];
            console.log("el = %O", element);
            if (element.type == 'button' && element.classList) {
                if (element.classList.contains("edit_btn")) {
                    element.disabled = false;
                    element.classList.remove("disabled");
                }
                else if (element.classList.contains("cancel_btn")) {
                    element.disabled = true;
                    element.classList.add("disabled");
                }
                else if (element.classList.contains("save_btn")) {
                    element.disabled = true;
                    element.classList.add("disabled");
                }
            }
        };

        test_name_element.innerHTML = test_name_element.getAttribute("original_text");
        test_message_element.innerHTML = test_message_element.getAttribute("original_text");

        test_name_element.removeAttribute("original_text");
        test_message_element.removeAttribute("original_text");

        test_name_element.removeAttribute("contenteditable");
        test_message_element.removeAttribute("contenteditable");
 
        document.activeElement.blur();
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

    function taskid_select_handler(event) {
        g_current_taskid = event.id;

        // set tab appearacnce
        let siblings = event.parentElement.children;
        
        for (var i = 0; i < siblings.length; i++) {
            var button_element = siblings[i];

            if (button_element.id == g_current_taskid) {
                button_element.style.background = "black";
                button_element.style.color = "white";
            } else {
                button_element.style.background = "white";
                button_element.style.color = "black";                
            }
        }

        // set category add button state

        // set code
        g_editor.setValue(g_task_code[g_current_taskid], -1);
        update_step(0);
    }

    function test_select_handler(event) {
        g_current_taskid = event.dataset.taskid;

        // TODO mark test as in-focus

        g_editor.setValue(g_task_code[g_current_taskid], -1);
        update_step(0);
    }

    // this function displays a message to the user, and hides it after 3 seconds
    function display_user_message(title, content, type, dismissible)
    {
        console.debug('In function: display_user_message(\n    %s,\n    %s,\n    %s,\n    %s)', 
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

    // =========================================================================================== //

    // this function saves a draft of the feedback manager page
    // ---
    function save_draft() {
        console.debug('In function: save_draft()');

        // send save request
        send_save_request(is_draft=true);

        // save to local storage
        save_to_storage();
    }

    // this function submits a final version of feedback
    // ---
    function submit() {
        console.debug('In function: submit()');

        // send save request
        send_save_request(is_draft=false);

        // if saved in local storge, remove draft
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([g_submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    // this function sends a request to save feedback in the database (draft or final)
    // ---
    function send_save_request(is_draft, show_message=true) {
        console.debug('In function: send_save_request(%s)', is_draft);

        // save version for debug purposes
        var footer_element = document.getElementById("footer");
        var version =  footer_element.innerHTML.split('INGInious ')[1].split(' ')[0];
        var feedback_summary_element = document.getElementById("bottom-total-feedback");
        g_feedback_summary = feedback_summary_element.value;
        
        console.debug("g_feedback_categories = %O", g_feedback_categories);
        // send save request
        var error_message = "";
        $.ajax({
                type: "POST",
                url: window.location.href + "?draft=" + is_draft,
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
                    if (show_message) {
                        var message = is_draft ? "Feedback draft was saved for student " + g_student : "Final feedback was submitted for student " + g_student;
                        display_user_message(message, "", "success", true);
                    }
                },
                error: function (e) {
                    console.log("save: " + e.toString());

                    // display message to user
                    error_message = "An internal error occurred";
                    display_user_message("Some error(s) occurred when saving the feedback: " + error_message, "", "danger", true);
                },
        });
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
                    add_test_code(test, true);
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

    //
    function get_test_from_element_id(element_id) {
        var element = null;
        for (const c in g_feedback_categories) {
            g_feedback_categories[c]['tests'].forEach(test => {
                if (test['element'] == element_id) {
                    element = test;
                }
            });
        }
        return element;
    }

    /**
     * Show and hide the section when click on dropdown button
     * @param header: the header on which we click
     */
    function task_dropdown(header) {
        const content_div = $(header.parentElement).siblings(".content");
        const dropdown_button = $(header).children(".category-dropdown-btn");
        const category = header.dataset.category

        if ($(dropdown_button).hasClass("fa-caret-down")) {
            // close
            g_feedback_categories[category]['is_open'] = false;
            $(dropdown_button).removeClass("fa-caret-down").addClass("fa-caret-right");
            content_div.slideUp('fast');
        } else {
            // open
            g_feedback_categories[category]['is_open'] = true;
            $(dropdown_button).removeClass("fa-caret-right").addClass("fa-caret-down");
            content_div.slideDown('fast');
        }
    }

    function category_add(header) {
        var category = header.dataset.category;
        var taskid = g_current_taskid;
        var tests;

        document.body.style.cursor = 'progress';

        console.log('category = %s', category);
        console.log('taskid = %s', taskid);

        if (!('tests' in g_feedback_categories[category])) {
            g_feedback_categories[category]['tests'] = [];
        }
        tests = g_feedback_categories[category]['tests'];

        // find a unique test number
        var new_test_num = 0;
        var manual_test_exists = true;
        while(manual_test_exists) {
            new_test_num++;
            var new_test_id = 'ManualTest' + new_test_num;
            var exists = false;
            tests.forEach(test => {
                if (test['id'] == new_test_id) {
                    exists  = true;
                }
            });
            manual_test_exists = exists;
        }
        
        console.log('new test num = %d', new_test_num);
        var new_test = {
            'category': category,
            'name': `Type ${category} comment title, for task ${taskid}, here...`,
            'id': 'ManualTest' + new_test_num,
            'taskid': taskid,
            'message': `Type ${category} comment, for task ${taskid}, here...`,
            'status': 'passed',
            'message_code': 0,
            'cout_text': 'N/A',
            'result': {'bool': true}
        }
        console.log('add manual test to category %s = %O', category, new_test);

        g_feedback_categories[category]['tests'].push(new_test);
        for (cat in g_feedback_categories) {
            g_feedback_categories[cat]['is_open'] = false;
        }
        g_feedback_categories[category]['is_open'] = true;
        g_feedback_categories['functionality']['current_taskid'] = g_current_taskid;
        send_save_request(is_draft=true, show_message=false);

        // if saved in local storge, remove draft to force reload from database
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([g_submissionid]);
        } else {
            alert("Your browser doesn't support web storage");
        }

        setTimeout(() => {
            location.reload();
        }, 3000);   
        // document.body.style.cursor = 'default';    
    }


    return {
        additional_info_close_handler: additional_info_close_handler,
        additional_info_open_handler: additional_info_open_handler,      
        category_add: category_add, 
        init_manage_feedback_page: init_manage_feedback_page,
        load_from_storage: load_from_storage,
        render_student_feedback: render_student_feedback,
        save_draft: save_draft,
        save_to_storage: save_to_storage,
        submit: submit,
        task_dropdown: task_dropdown,
        taskid_select_handler: taskid_select_handler,
        test_checkbox_handler: test_checkbox_handler,
        test_edit_handler: test_edit_handler,
        test_edit_cancel_handler: test_edit_cancel_handler,        
        test_edit_save_handler: test_edit_save_handler,
        test_remove_handler: test_remove_handler,
        test_select_handler: test_select_handler,
        update_step: update_step
    }

})(jQuery);

// Roi's SPlit table changes
document.addEventListener('DOMContentLoaded', () => {
    const codeSectionSelector = document.getElementById(CODE_SELECTOR_ID);
    const leftPanel = document.getElementById(LEFT_PANEL_ID);
    const codeViewer = document.getElementById('codeViewer');
    const divider = document.getElementById('divider');
    const showCodeButton = document.getElementById('showCodeButton');
    const closeCodeButton = document.getElementById('closeCodeButton');

    // Show the Code Viewer when the button is clicked
    showCodeButton.addEventListener('click', () => {
        codeViewer.style.display = 'flex'; // Show code viewer
        showCodeButton.style.display = 'none'; // Hide the show button when viewer is visible
        closeCodeButton.style.display = 'initial';

        // set initial value
        g_editor.setValue(g_task_code[g_current_taskid], -1);
    });

    // Close the Code Viewer
    closeCodeButton.addEventListener('click', () => {
        codeViewer.style.display = 'none'; 
        closeCodeButton.style.display = 'none'; // Hide code viewer
        showCodeButton.style.display = 'initial'; // Show the circular button again
    });
    
    // Handle resizing between left panel and code viewer
    let isResizing = false;
    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = document.querySelector('.feedback-container').getBoundingClientRect();
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