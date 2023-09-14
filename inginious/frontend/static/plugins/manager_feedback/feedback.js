/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var FeedbackPlugin = (function () {
    const default_categories = ['submission', 'functionality']
    var currentStep = 1
    var filter = "all"
    var courseid = ""
    var taskid = ""
    var submissionid = ""
    var student = ""
    var checkedSections = []
    var displayedSections = []
    var categories = []
    var tests = {}
    var draft_categories = []
    var total_feedback = ""

    function init_variables(input_courseid, input_taskid, input_submissionid, input_student) {
        courseid = input_courseid;
        taskid = input_taskid;
        submissionid = input_submissionid;
        student = input_student;
        try {
            load_from_storage();
        } catch (e) {
            console.log("there is nothing in storage");
        }
    }

    function init_manage_feedback_page(feedbacks) {
        categories = feedbacks;
        for (const key in feedbacks) {
            var category = feedbacks[key];

            if (category['feedback'] && category['feedback'].length > 0) {
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
                tests[test['name']] = test;
                add_test_popup(test);
                add_test_messages(test, false);
            })
            if (default_categories.includes(key)) {
                if (!checkedSections.includes('feedback-' + key)) {
                    checkedSections.push('feedback-' + key);
                    displayedSections.push('feedback-' + key);
                }
                category['tests'].forEach( test => {
                    if (!checkedSections.includes(test['name'])) {
                        checkedSections.push(test['name']);
                        displayedSections.push(test['name']);
                    }
                })
            }
        }
        console.log(checkedSections);
        console.log(displayedSections);

        var next_student_btn = $(".next-student-btn");
        next_student_btn.click(function() {
            save_to_storage();
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
                success: function(response) {
                    console.log("prev: success");
                    if (response) {
                        send_request_for_another_student(response);
                    } else {
                        studio_display_feedback_submit_message("No more students made submission for this course", "", "danger", true);
                    }
                },
                error: function (e) {
                    console.log("prev: " + e)
                },
            });
        })

        var href = window.location.href.split("/");
        href[href.indexOf("manager_feedback")] = "course";
        var submissionid = href.pop();
        href = href.join('/');
        href = href + "?submissionid=" + submissionid + "&questionid=program";
        var download_btn = $(".download-btn");
        download_btn.attr('href', href);

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

        if (currentStep === 1) {
            $("#back-btn")[0].disabled = 'true';
            $(".message").css("display", "none");
            $('#select-btn').val('failed');
            update_filter($('#select-btn')[0]);
        } else {
            console.log("render page - update_page", currentStep)
            update_page(currentStep);
        }
    }

    function add_test_popup(test) {
        if ((('cout_text' in test) && test['cout_text']) || (('cout_file' in test) && test['cout_file'])) {
            $("." + test['name'].replace(/ /g, '') + "-popup").css("display", "initial");
        }
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

    function update_filter(event) {
        var value = event.value;
        filter = value;
        console.log({value});
        if (value === "passed") {
            var passed_categories = $("div[data-status=100]")
            for (var i = 0; i < passed_categories.length; i++){
                change_display_mode(passed_categories[i], "flex");
            }
            var failed_categories = $("div[data-status=0]")
            for (var i = 0; i < failed_categories.length; i++){
                change_display_mode(failed_categories[i], "none");
            }
            var passed_tests = $("div[data-result=passed]")
            for (var i = 0; i < passed_tests.length; i++){
                change_display_mode(passed_tests[i], "flex");
            }
            var failed_tests = $("div[data-result=failed]")
            for (var i = 0; i < failed_tests.length; i++){
                change_display_mode(failed_tests[i], "none");
            }
        } else if (value === "failed") {
            var passed_categories = $("div[data-status=100]")
            for (var i = 0; i < passed_categories.length; i++){
                change_display_mode(passed_categories[i], "none");
            }
            var failed_categories = $("div[data-status=0]")
            for (var i = 0; i < failed_categories.length; i++){
                change_display_mode(failed_categories[i], "flex");
            }
            var passed_tests = $("div[data-result=passed]")
            for (var i = 0; i < passed_tests.length; i++){
                change_display_mode(passed_tests[i], "none");
            }
            var failed_tests = $("div[data-result=failed]")
            for (var i = 0; i < failed_tests.length; i++){
                change_display_mode(failed_tests[i], "flex");
            }
        } else {
            // All
            var all_tests = $(".test-data")
            for (var i = 0; i < all_tests.length; i++){
                change_display_mode(all_tests[i], "flex");
            }
            var all_categories = $(".category")
            for (var i = 0; i < all_categories.length; i++){
                change_display_mode(all_categories[i], "flex");
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
        var page_tests = $("#feedbacks .displayed_test_feedback");

        if (currentStep === 3) {
            make_preview();
            $("#submit-buttons")[0].style.display = 'flex';
        } else if (currentStep === 2) {
            $("#submit-buttons")[0].style.display = 'none';
            var checkboxes = $("#feedbacks input[type='checkbox']");
            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'none';
            }
            for (var i = 0; i < page_tests.length; i++) {
                if (!displayedSections.includes(page_tests[i].id)) {
                    page_tests[i].style.display = 'none';
                }
            }
            for (var i = 0; i < page_categories.length; i++) {
                if (!displayedSections.includes(page_categories[i].id)) {
                    page_categories[i].style.display = 'none';
                } else {
                    var messageInputs = $(".message-" + page_categories[i].id);
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
            for (var i = 0; i < page_tests.length; i++) {
                page_tests[i].style.display = 'flex';
            }
            for (var i = 0; i < page_categories.length; i++) {
                page_categories[i].style.display = 'flex';
                var messageInputs = $(".message-" + page_categories[i].id);
                for (var j = 0; j < messageInputs.length; j++) {
                    messageInputs[j].style.display = 'none';
                }
            }
            $(".total-feedback")[0].style.display = 'none';
        }
        $('#select-btn').val(filter);
        update_filter($('#select-btn')[0]);
        window.scrollTo(0,0);
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

    function send_request_for_another_student(response) {
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
                    console.log("update: " + e)
                },
            });
        } else {
            console.log("no more students made submission for this task")
        }
    }

    function print_popup(data, line) {
        data.split("\n").forEach(text => {
            line = $('<li></li>');
            line.text(text);
            $("#popup-text").append(line);
        })
    }

    function open_popup(event) {
        const test_element = event.closest(".displayed_test_feedback");
        const test_id = test_element.attributes['id'].value;
        const test = tests[test_id];
        var cout_text = test['cout_text'] || "";
        var line;
        if (cout_text) {
            print_popup(cout_text, line);
        } else {
            $.ajax({
                    type: "GET",
                    url: window.location.origin + '/feedback/' + courseid + "/" + taskid + "/" + submissionid + '/cout?cout=' + test['cout_file'],
                    success: function(data) {
                        console.log("success");
                        print_popup(data, line);
                    },
                    error: function (e) {
                        console.log(e)
                        line = $('<li></li>');
                        line.text("Internal server error");
                        $("#popup-text").append(line);
                    },
            })
        }
        $("#popup").css("display", "initial");
    }

    function close_popup (event) {
        $("#popup").css("display", "none");
        $("#popup-text").empty();
    }

    function studio_display_feedback_submit_message(title, content, type, dismissible)
    {
        var code = getAlertCode(title, content, type, dismissible);
        $('#feedback_submit_status').html(code);
        window.scrollTo(0,0);
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

    function save_to_storage() {
        var total_feedback = $("#total-feedback").val();
        var categories_for_save = {}
        for (const key in categories) {
            if (displayedSections.includes('feedback-' + key)) {
                categories_for_save[key] = JSON.parse(JSON.stringify(categories[key]));
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
                "current_filter": filter,
            };
            localStorage.setItem(courseid + "/" + taskid + "/" + submissionid, JSON.stringify(data));
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    function load_from_storage() {
        if (typeof (Storage) !== "undefined") {
            var data = localStorage[courseid + "/" + taskid + "/" + submissionid];
            data = JSON.parse(data);
            currentStep = data.currentStep ? data.currentStep : 1;
            checkedSections = data.checkedSections ? data.checkedSections : [];
            displayedSections = data.displayedSections ? data.displayedSections : [];
            draft_categories = data.feedback_draft ? data.feedback_draft : [];
            total_feedback = data.total_feedback ? data.total_feedback : '';
            filter = data.current_filter ? data.current_filter : "failed";
            for (const key in draft_categories) {
                $("#message-feedback-" + key).val(draft_categories[key]['feedback']);
            }
            $("#total-feedback").val(total_feedback)
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    function save_draft() {
        send_save_request(categories,false);
        save_to_storage();
    }

    function submit() {
        send_save_request(categories, true);
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([courseid + "/" + taskid + "/" + submissionid]);
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
                success: function(response) {
                    console.log("preview: success");
                    var html = response.replace(/.. raw:: html/g, "");
                    $("#draft").html(html);

                },
                error: function (e) {
                    console.log("preview: " + e)
                },
        });
    }

    function send_save_request(feedback, is_final_version) {
        var feedback_categories = JSON.parse(JSON.stringify(feedback));
        var category;
        for (const key in feedback_categories) {
            category = feedback_categories[key]
            category['feedback'] = $("#message-feedback-" + key).val();
            category['selected'] = checkedSections.includes("feedback-" + key);
            category['tests'].forEach(test => {
                    test['selected'] = checkedSections.includes(test['name']);
            });
        };
        total_feedback = $("#total-feedback").val();

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
                    var message = is_final_version ? "Feedback was submitted for student " + student : "Feedback was saved for student " + student;
                    studio_display_feedback_submit_message(message, "", "success", true);
                },
                error: function (e) {
                    console.log("save: " + e.toString());
                    error_message = "An internal error occurred";
                    studio_display_feedback_submit_message("Some error(s) occurred when saving the feedback: " + error_message, "", "danger", true);
                },
        });
    }

    function add_test_messages(test, is_draft) {
        if (test['message']) {
            var messages = test['message'].split("\n");
            var extra_text = is_draft ? "test-" : "";
            var taskid = test['taskid'] ? test['taskid'] : "";
            messages.forEach(message => {
                message = message.replaceAll(/\"/g, '\\\"')
                var line = $('<p style="margin: 0"></p>');
                line.text(message);
                $("." + extra_text + taskid + test['name'].replace(/ /g, '') + "-message").append(line);
            })
        }
    }

    function sort_categories(feedback_categories) {
        console.log("here")
        var keys = Object.keys(feedback_categories);
        keys.sort((k1, k2) => {
            if (default_categories.includes(k1) && !default_categories.includes(k2)) {
                return -1;
            } else if (!default_categories.includes(k1) && default_categories.includes(k2)) {
                return 1;
            } else if (default_categories.includes(k1) && default_categories.includes(k2)) {
                return default_categories.indexOf(k1) < default_categories.indexOf(k2) ? -1 : 1;
            }
            return k1.localeCompare(k2);
        })
        var sorted_categories = {};
        for (const key of keys) {
            sorted_categories[key] = feedback_categories[key];
        }
        return sorted_categories;
    }

    function render_student_feedback(feedback_data, input_courseid, input_taskid, input_submissionid) {
        courseid = input_courseid;
        taskid = input_taskid;
        submissionid = input_submissionid;
        var category_section;
        console.log('here is feedbackData from Gitlab');
        console.log(feedback_data);
        if (feedback_data['total_feedback']) {
            var total_feedback = $(tmpl('tmpl-total-feedback', feedback_data['total_feedback']));
            $('#scenarios-table').append(total_feedback);
        }
        var feedback_categories = sort_categories(feedback_data['categories']);
        for (const key in feedback_categories) {
            var data = feedback_categories[key]
            if (data['tests'].length > 0) {
                data["category"] = key
                console.log('here is feedback category data', data);
                category_section = $(tmpl('tmpl-category', data));
                $('#scenarios-table').append(category_section);
                if (default_categories.includes(key)) {
                    var color = '#5bc0de';
                    if (data['status']['percent'] == 100) {
                        color = '#318331'
                    } else if (data['status']['percent'] > 80) {
                        color = '#e4e729'
                    } else if (data['status']['percent'] > 50) {
                        color = '#ffbc40'
                    } else {
                        color = '#fd4242'
                    }
                    $('#feedback-' + key + ' .category-header').css('background-color', color);
                    var info = $('<span></span>');
                    info.text(' - ' + data['status']['passed'] + '/' + data['status']['total'] + ' ' + data['status']['percent'] + '%');
                    $('#feedback-' + key + '-info').append(info);
                }
                data['tests'].forEach(test => {
                    if (default_categories.includes(test['category'])) {
                        if (test['result']['text'] === 'passed') {
                            test["border_color"] = 'green';
                        } else if (test['result']['text'] === 'failed') {
                            test["border_color"] = 'red';
                        }
                    }
                    var test_section = $(tmpl('tmpl-test', test));
                    $('#feedback-' + key + '-tests .test-container').append(test_section);
                    tests[test['name']] = test;
                    add_test_popup(test);
                    add_test_messages(test, true);
                })
                $('.print-head').hide()
            }
        };
        if (feedback_data['draft'] === false) {
            var popup_section = $(tmpl('tmpl-popup', data));
            $('#scenarios-table').append(popup_section);
        }
        $('#select-btn').val(filter);
        update_filter($('#select-btn')[0]);
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


