/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var FeedbackPlugin = (function () {
    const default_categories = ['submission', 'functionality']
    var currentStep = 1
    var courseid = ""
    var taskid = ""
    var checkedSections = []
    var displayedSections = []
    var current_student = ""
    var previous_student = ""
    var next_student = ""
    var categories = []
    var draft_categories = []
    var total_feedback = ""

    function init_variables(student_username, input_courseid, input_taskid) {
        courseid = input_courseid;
        taskid = input_taskid;
        current_student = student_username;
        try {
            load_from_storage();
        } catch (e) {
            console.log("there is nothing in storage");
        }
    }

    function init_manage_feedback_page(feedbacks) {
        feedbacks = feedbacks
            .replace(/&#39;/g, '"')
            .replace(/True/g, "true")
            .replace(/False/g, "false")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, "\\n")
            .replace(/'/g, '"')
            .replace(/&quot;/g, '"')
            .replace(/&#34;/g, '\\"')
            .replace(/None/g, '""');
        feedbacks = JSON.parse(feedbacks);
        categories = feedbacks;
        for (const key in feedbacks) {
            var category = feedbacks[key];

            if (category['feedback'].length > 0) {
                $("#message-feedback-" + key).val(category['feedback']);
            }
            if ('selected' in category) {
                if (category['selected'] && !checkedSections.includes('feedback-' + key)){
                    checkedSections.push('feedback-' + key);
                    displayedSections.push('feedback-' + key);
                }
            }
            category['tests'].forEach(test => {
                if ('selected' in test && test['selected'] && !checkedSections.includes(test['name'])) {
                    checkedSections.push(test['name']);
                    displayedSections.push(test['name']);
                    if (!displayedSections.includes('feedback-' + key)){
                        displayedSections.push('feedback-' + key);
                    }
                }
            })
            if (default_categories.includes(key)) {
                if (!checkedSections.includes('feedback-' + key)) {
                    checkedSections.push('feedback-' + key);
                    displayedSections.push('feedback-' + key);
                }
                var tests = category['tests']
                tests.forEach( test => {
                    if (!checkedSections.includes(test['name'])) {
                        checkedSections.push(test['name']);
                        displayedSections.push(test['name']);
                    }
                })
            }
        }
        console.log(checkedSections);
        console.log(displayedSections);

        var checkboxes = $("#feedbacks input[type='checkbox']");
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkedSections.includes(checkboxes[i].value)) {
                checkboxes[i].checked = true;
                var category_name = "";
                if (checkboxes[i].value.startsWith("feedback-")) {
                    category_name = checkboxes[i].id.replace("checkBoxSelect-feedback-", "");
                } else {
                    category_name = checkboxes[i].closest('.displayed_feedback').id.replace("feedback-", "");
                }
                if (default_categories.includes(category_name)) {
                        checkboxes[i].disabled = true;
                }
            }
        }

        var next_student_btn = $(".next-student-btn");
        next_student_btn.click(function() {
            save_to_storage();
            $.ajax({
                type: "GET",
                url: window.location.href + "/next",
                success: function(data) {
                    console.log("next: success");
                },
                error: function (e) {
                    console.log("next: " + e)
                },
            });
        })

        var previous_student_btn = $(".previous-student-btn");
        previous_student_btn.click(function() {
            save_to_storage();
            $.ajax({
                type: "GET",
                url: window.location.href + "/prev",
                success: function(data) {
                    console.log("prev: success");
                },
                error: function (e) {
                    console.log("prev: " + e)
                },
            });
        })

        var download_btn = $(".download-btn");
        download_btn.click(function() {
            var href = window.location.href.split("/");
            href[href.indexOf("manager_feedback")] = "course";
            var submissionid = href.pop();
            href = href.join('/');
            $.ajax({
                type: "GET",
                url: href + "?submissionid=" + submissionid + "&questionid=gitlab",
                success: function(data) {
                    console.log("download: success");
                },
                error: function (e) {
                    console.log("download: " + e)
                },
            });
        })

        if (currentStep === 1) {
            $("#back-btn")[0].disabled = 'true';
            $(".message").css("display", "none");
        } else {
            console.log("render page - update_page", currentStep)
            update_page(currentStep);
        }
    }

    function add_popup(event) {
        var cout_text = "";
        $.ajax({
                type: "GET",
                url: window.location.href + '/cout?cout=' + event.closest(".displayed_test_feedback").id.replace(/ /g, ""),
                success: function(data) {
                    console.log("success");
                    cout_text = data.split("\n");
                    cout_text.forEach(text => {
                        var line = $('<li></li>');
                        line.text(text);
                        $("#popup-text").append(line);
                    })
                },
                error: function (e) {
                    console.log(e)
                },
        });
        $("#popup").css("display", "initial");
    }

    function close_popup (event) {
        $("#popup").css("display", "none");
        $("#popup-text").empty();
    }

    function change_display_mode(category, mode) {
        if (currentStep === 2) {
            if (displayedSections.includes(category.id)) {
                category.style.display = mode
            }
        } else {
            category.style.display = mode
        }
    }

    function update_filter(value) {
        console.log({value});
        if (value === "Passed") {
            var passed_tests = $("div[data-result=Passed]")
            for (var i = 0; i < passed_tests.length; i++){
                change_display_mode(passed_tests[i], "flex");
            }
            var failed_tests = $("div[data-result=Failed]")
            for (var i = 0; i < failed_tests.length; i++){
                change_display_mode(failed_tests[i], "none");
            }
            var failed_categories = $("div[data-status=0]")
            for (var i = 0; i < failed_categories.length; i++){
                change_display_mode(failed_categories[i], "none");
            }
            var passed_categories = $("div[data-status=100]")
            for (var i = 0; i < passed_categories.length; i++){
                change_display_mode(passed_categories[i], "flex");
            }
        } else if (value === "Failed") {
            var passed_tests = $("div[data-result=Passed]")
            for (var i = 0; i < passed_tests.length; i++){
                change_display_mode(passed_tests[i], "none");
            }
            var failed_tests = $("div[data-result=Failed]")
            for (var i = 0; i < failed_tests.length; i++){
                change_display_mode(failed_tests[i], "flex");
            }
            var failed_categories = $("div[data-status=0]")
            for (var i = 0; i < failed_categories.length; i++){
                change_display_mode(failed_categories[i], "flex");
            }
            var passed_categories = $("div[data-status=100]")
            for (var i = 0; i < passed_categories.length; i++){
                change_display_mode(passed_categories[i], "none");
            }
        } else {
            // All
            var passed_tests = $(".test-data")
            for (var i = 0; i < passed_tests.length; i++){
                change_display_mode(passed_tests[i], "flex");
            }
            var passed_categories = $(".category")
            for (var i = 0; i < passed_categories.length; i++){
                change_display_mode(passed_categories[i], "flex");
            }
        }
    }

    function update_step(accumulator) {
        currentStep += accumulator;
        save_to_storage();
        update_page(currentStep);
    }

    function update_page(currentStep) {
        try {
            load_from_storage();
        } catch (e) {
            console.log("there is nothing in storage");
        }
        $("#back-btn")[0].disabled = currentStep === 1;
        $("#next-btn")[0].disabled = currentStep === 3;
        // Toggle buttons
        var _currentStep = currentStep + ""
        $(".step-indicator").css('opacity', '0.3')
        $("div[data-step=" + _currentStep + "]").css('opacity', '1')
        // Toggle views
        $(".step"+ _currentStep + "-view").css('display', 'initial');
        $(".step-view").not(".step"+ _currentStep + "-view").css('display', 'none');

        var page_categories = $("#feedbacks .displayed_feedback");
        var tests = $("#feedbacks .displayed_test_feedback");
        if (currentStep === 3) {
            console.log("update_page in update_page", currentStep)
            make_preview();
            $("#submit-buttons")[0].style.display = 'flex';
        } else if (currentStep === 2) {
            $("#submit-buttons")[0].style.display = 'none';
            var checkboxes = $("#feedbacks input[type='checkbox']");
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'none';
            }
            for (var i = 0; i < tests.length; i++) {
                if (!displayedSections.includes(tests[i].id)) {
                    tests[i].style.display = 'none';
                    console.log("delete" + tests[i].id);
                }
            }
            for (var i = 0; i < page_categories.length; i++) {
                if (!displayedSections.includes(page_categories[i].id)) {
                    page_categories[i].style.display = 'none';
                    console.log("delete" + page_categories[i].id);
                } else {
                    var messageInputs = $(".message-" + page_categories[i].id);
                    console.log({messageInputs})
                    for (var j = 0; j < messageInputs.length; j++) {
                        messageInputs[j].style.display = 'initial';
                    }
                }
            }
            $(".total-feedback")[0].style.display = 'initial';
        }else {
            $("#submit-buttons")[0].style.display = 'none';
            var checkboxes = $("#feedbacks input[type='checkbox']");

            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'initial';
            }
            for (var i = 0; i < tests.length; i++) {
                tests[i].style.display = 'flex';
            }
            for (var i = 0; i < page_categories.length; i++) {
                page_categories[i].style.display = 'flex';
                var messageInputs = $(".message-" + page_categories[i].id);
                console.log({messageInputs})
                for (var j = 0; j < messageInputs.length; j++) {
                    messageInputs[j].style.display = 'none';
                }
            }
            $(".total-feedback")[0].style.display = 'none';
        }
        var show_buttons = $(".show_btn");
        for (var i = 0; i < show_buttons.length; i++) {
            show_buttons[i].disabled = currentStep === 3;
        }
    }

    function select_category_or_test(event) {
        if (event.checked) {
            if (event.value.startsWith("feedback")) {
                var checkboxes = $("#" + event.value + " input[type='checkbox']");
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = true;
                    checkedSections.push(checkboxes[i].value);
                    displayedSections.push(checkboxes[i].value);
                }
            } else {
                checkedSections.push(event.value);
                displayedSections.push(event.value);
                var test_category = event.closest('.displayed_feedback');
                if (!displayedSections.includes(test_category.id)) {
                    displayedSections.push(test_category.id);
                }
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
                var checkboxes = $("#" + event.value + " input[type='checkbox']");
                for (var i = 0; i < checkboxes.length; i++) {
                    checkboxes[i].checked = false;
                    checkedSections = checkedSections.filter(v => v !== checkboxes[i].value);
                    displayedSections = displayedSections.filter(v => v !== checkboxes[i].value);
                }
            } else {
                checkedSections = checkedSections.filter(v => v !== event.value);
                displayedSections = displayedSections.filter(v => v !== event.value);
                var test_category = event.closest('.displayed_feedback');
                var checkbox = $("#" + test_category.id + " input[type='checkbox']")[0];
                checkbox.checked = false;
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
        console.log(checkedSections)
        console.log(displayedSections);
    }

    function save_to_storage() {
        var total_feedback = $("#total-feedback").val();
        var categories_for_save = {}
        for (const key in categories) {
            if (displayedSections.includes('feedback-' + key)) {
                categories_for_save[key] = categories[key]
            }
        }
        for (const key in categories_for_save) {
            var category = categories_for_save[key]
            category['feedback'] = $("#message-feedback-" + key).val();
            category['tests'] = category['tests'].filter(test =>
                displayedSections.includes(test['name'])
            )
        }
        if (typeof (Storage) !== "undefined") {
            var data = {
                "currentStep": currentStep,
                "checkedSections": checkedSections,
                "displayedSections": displayedSections,
                "feedback_draft": categories_for_save,
                "total_feedback": total_feedback,
            };
            localStorage.setItem(courseid + "/" + taskid + "/" + current_student, JSON.stringify(data));
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    function load_from_storage() {
        if (typeof (Storage) !== "undefined") {
            var data = localStorage[courseid + "/" + taskid + "/" + current_student];
            data = JSON.parse(data);
            currentStep = data.currentStep ? data.currentStep : 1;
            checkedSections = data.checkedSections ? data.checkedSections : [];
            displayedSections = data.displayedSections ? data.displayedSections : [];
            draft_categories = data.feedback_draft ? data.feedback_draft : [];
            total_feedback = data.total_feedback ? data.total_feedback : '';
            for (const key in draft_categories) {
                $("#message-feedback-" + key).val(draft_categories[key]['feedback']);
            }
            $("#total-feedback").val(total_feedback)
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    function save_draft() {
        var feedback_categories = categories
        for (const key in feedback_categories) {
            var category = feedback_categories[key]
            if (checkedSections.includes("feedback-" + key)) {
                category['selected'] = true;
            }
            category['tests'].forEach(test => {
                if (checkedSections.includes(test['name'])) {
                    test['selected'] = true;
                }
            });
        };
        send_save_request(feedback_categories,false);
        save_to_storage();
    }

    function submit() {
        var feedback_categories = draft_categories;
        // for (const key in draft_categories) {
        //     if (displayedSections.includes("feedback-" + key)) {
        //         feedback_categories[key] = draft_categories[key];
        //         feedback_categories[key]['tests'] = feedback_categories[key]['tests'].filter(test =>
        //             displayedSections.includes(test['name'])
        //         );
        //     }
        // }
        send_save_request(feedback_categories, true);
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([courseid + "/" + taskid + "/" + current_student]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    function make_preview() {
        send_preview_request();
        save_to_storage();
    }

    function send_preview_request() {
        $.ajax({
                type: "POST",
                url: window.location.href + "/preview",
                contentType: 'application/json',
                data: JSON.stringify({
                    "categories": draft_categories,
                    "total_feedback": total_feedback,
                }),
                success: function(data) {
                    console.log("preview: success");
                    var html = data.replace(/.. raw:: html/g, "");
                    console.log(html)
                    $("#draft").html(html);

                },
                error: function (e) {
                    console.log("preview: " + e)
                },
        });
    }

    function send_save_request(feedback, is_final_version) {
        $.ajax({
                type: "POST",
                url: window.location.href,
                contentType: 'application/json',
                data: JSON.stringify({
                    "categories": feedback,
                    "total_feedback": total_feedback,
                    "draft": !is_final_version,
                }),
                success: function(data) {
                    console.log("save: success");
                },
                error: function (e) {
                    console.log("save: " + e);
                },
        });
    }

    function renderGitlabRows(feedback_data) {
        var category_section;
        console.log('here is feedbackData from Gitlab');
        console.log(feedback_data);
        var total_feedback = $(tmpl('tmpl-total-feedback', feedback_data['total_feedback']));
        $('#scenarios-table-' + taskid).append(total_feedback);

        var feedback_categories = feedback_data['categories'];

        for (const key in feedback_categories) {
            var data = feedback_categories[key]
            if (data['tests'].length > 0) {
                data["category"] = key
                console.log('here is feedback category data', data);
                category_section = $(tmpl('tmpl-category', data));
                $('#scenarios-table-' + taskid).append(category_section);
                data['tests'].forEach(test => {
                    test["border_color"] = test['result']['text'] === 'Passed' ? 'green' : 'red'
                    var test_section = $(tmpl('tmpl-test', test));
                    $('#feedback-' + key + '-tests .test-container').append(test_section);
                })
                $('.print-head').hide()
            }
        };
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
        add_popup: add_popup,
        close_popup: close_popup,
        renderGitlabRows: renderGitlabRows
    }
})(jQuery);


