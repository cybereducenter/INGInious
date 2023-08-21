/**
 * ManualPlugin
 *
 * @type {{onClickSave, onSubmitAllBtn, onCloseWindow, getDefaultFeedbacksValue, onClickArrowBtn, onChangeOverallGrade, initManualTask}}
 */
var FeedbackPlugin = (function () {
    var courseid = ""
    var taskid = ""
    var currentStep = 1
    var checkedSections = []
    var displayedSections = []
    const default_categories = ['func', 'config']
    var students_list = []
    var current_student = ""
    var previous_student = ""
    var next_student = ""
    var categories = []
    var total_feedback = ""
    var url = ""

    function init_variables(student_username, students, input_courseid, input_taskid) {
        courseid = input_courseid;
        taskid = input_taskid;
        current_student = student_username;
        try {
            load_from_storage();
        } catch (e) {
            console.log("there is nothing in storage");
        }
        if (students_list.length === 0) {
            students = JSON.parse(students.replace(/&#39;/g, '"'));
            students_list = students_list.concat(students);
        }
        var current_student_index = students_list.indexOf(student_username)
        if (current_student_index === 0) {
            previous_student = students_list[students_list.length - 1];
            next_student = students_list[current_student_index + 1];
        } else if (current_student_index === students_list.length - 1) {
            previous_student = students_list[current_student_index - 1];
            next_student = students_list[0];
        } else {
            previous_student = students_list[current_student_index - 1];
            next_student = students_list[current_student_index + 1];
        }
    }

    function init_manage_feedback_page(feedbacks, path) {
        url = path;
        feedbacks = feedbacks
            .replace(/&#39;/g, '"')
            .replace(/True/g, "true")
            .replace(/False/g, "false")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, "\\n")
            .replace(/'/g, '"')
            .replace(/&quot;/g, '"')
            .replace(/&#34;/g, '\\"');
        feedbacks = JSON.parse(feedbacks);
        categories = feedbacks;
        feedbacks.forEach( feedback => {
            var category = feedback;
            if (category['feedback'].length > 0) {
                $("#message-feedback-" + category['category_eng']).val(category['feedback']);
            }
            if ('checked' in category) {
                if (category['checked'] && !displayedSections.includes('feedback-' + category['category_eng'])){
                    checkedSections.push('feedback-' + category['category_eng']);
                    displayedSections.push('feedback-' + category['category_eng']);
                }
                category['tests'].forEach(test => {
                    if (test['checked'] && !displayedSections.includes(test['name'])) {
                        checkedSections.push(test['name']);
                        displayedSections.push(test['name']);
                    }
                })
            }
            else if (default_categories.includes(category['category_eng'])) {
                if (!displayedSections.includes('feedback-' + category['category_eng'])) {
                    checkedSections.push('feedback-' + category['category_eng']);
                    displayedSections.push('feedback-' + category['category_eng']);
                }
                var tests = category['tests']
                tests.forEach( test => {
                    if (!displayedSections.includes(test['name'])) {
                        checkedSections.push(test['name']);
                        displayedSections.push(test['name']);
                    }

                })
            }
        })
        console.log(checkedSections);

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
          window.location.href = path + '/manager_feedback/' + courseid + '/' + taskid + '/' + next_student;
          save_to_storage();
        })

        var previous_student_btn = $(".previous-student-btn");
        previous_student_btn.click(function() {
          window.location.href = path + '/manager_feedback/' + courseid + '/' + taskid + '/' + previous_student;
          save_to_storage();
        })

        if (currentStep > 1) {
            update_page(currentStep);
        }
    }

    function add_popup(event) {
        var cout_text = "";
        $.ajax({
                type: "POST",
                url: window.location.href + "/" + event.closest(".displayed_test_feedback").id.replace(/ /g, ""),
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

    function update_filter(value) {
        console.log({value});
        if (value === "Passed") {
            var passed_tests = $("div[data-result=Passed]")
            for (var i = 0; i < passed_tests.length; i++){
                if (displayedSections.includes(passed_tests[i].id)){
                   passed_tests[i].style.display='flex'
                }
            }
            var failed_tests = $("div[data-result=Failed]")
            for (var i = 0; i < failed_tests.length; i++){
                if (displayedSections.includes(failed_tests[i].id)){
                   failed_tests[i].style.display='none'
                }
            }
            var failed_categories = $("div[data-status=0]")
            for (var i = 0; i < failed_categories.length; i++){
                if (displayedSections.includes(failed_categories[i].id)){
                   failed_categories[i].style.display='none'
                }
            }
            var passed_categories = $("div[data-status=100]")
            for (var i = 0; i < passed_categories.length; i++){
                if (displayedSections.includes(passed_categories[i].id)){
                   passed_categories[i].style.display='flex'
                }
            }
        } else if (value === "Failed") {
            var passed_tests = $("div[data-result=Passed]")
            for (var i = 0; i < passed_tests.length; i++){
                if (displayedSections.includes(passed_tests[i].id)){
                   passed_tests[i].style.display='none'
                }
            }
            var failed_tests = $("div[data-result=Failed]")
            for (var i = 0; i < failed_tests.length; i++){
                if (displayedSections.includes(failed_tests[i].id)){
                   failed_tests[i].style.display='flex'
                }
            }
            var failed_categories = $("div[data-status=0]")
            for (var i = 0; i < failed_categories.length; i++){
                if (displayedSections.includes(failed_categories[i].id)){
                   failed_categories[i].style.display='flex'
                }
            }
            var passed_categories = $("div[data-status=100]")
            for (var i = 0; i < passed_categories.length; i++){
                if (displayedSections.includes(passed_categories[i].id)){
                   passed_categories[i].style.display='none'
                }
            }
        } else {
            // All
            var passed_tests = $(".cate")
            for (var i = 0; i < passed_tests.length; i++){
                if (displayedSections.includes(passed_tests[i].id)){
                   passed_tests[i].style.display='flex'
                }
            }
            var passed_categories = $(".category")
            for (var i = 0; i < passed_categories.length; i++){
                if (displayedSections.includes(passed_categories[i].id)){
                   passed_categories[i].style.display='flex'
                }
            }
        }
    }

    function update_step(accumulator) {
        if (currentStep === 1 && accumulator === -1) {
            currentStep = 1;
        } else if (currentStep === 3 && accumulator === 1) {
            currentStep = 3;
        } else {
            currentStep += accumulator;
        }

        // Toggle buttons
        var _currentStep = currentStep + ""

        $(".step-indicator").css('opacity', '0.3')
        $("div[data-step=" + _currentStep + "]").css('opacity', '1')

        // Toggle views
        $(".step"+ _currentStep + "-view").css('display', 'initial');
        $(".step-view").not(".step"+ _currentStep + "-view").css('display', 'none');

        update_page(currentStep);

        save_to_storage();
    }

    function update_page(currentStep) {
        var categories = $("#feedbacks .displayed_feedback");
        var tests = $("#feedbacks .displayed_test_feedback");
        if (currentStep > 1) {
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
            for (var i = 0; i < categories.length; i++) {
                if (!displayedSections.includes(categories[i].id)) {
                    categories[i].style.display = 'none';
                    console.log("delete" + categories[i].id);
                } else {
                    var messageInputs = $(".message-" + categories[i].id);
                    console.log({messageInputs})
                    for (var j = 0; j < messageInputs.length; j++) {
                        messageInputs[j].style.display = 'initial';
                    }
                }
            }
            $(".total-feedback")[0].style.display = 'initial';
            if (currentStep === 3) {
                make_preview();
            }
        } else {
            var checkboxes = $("#feedbacks input[type='checkbox']");

            for (var i = 0; i < checkboxes.length; i++) {
                checkboxes[i].style.display = 'initial';
            }
            for (var i = 0; i < tests.length; i++) {
                tests[i].style.display = 'flex';
            }
            for (var i = 0; i < categories.length; i++) {
                categories[i].style.display = 'flex';
                var messageInputs = $(".message-" + categories[i].id);
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
    }

    function save_to_storage() {
        var total_feedback = $("#total-feedback").val();
        categories.forEach( category => {
            category['feedback'] = $("#message-feedback-" + category['category_eng']).val();
        })
        if (typeof (Storage) !== "undefined") {
            var data = {
                "currentStep": currentStep,
                "checkedSections": checkedSections,
                "displayedSections": displayedSections,
                "feedback_draft": categories,
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
            categories = data.feedback_draft ? data.feedback_draft : [];
            total_feedback = data.total_feedback ? data.total_feedback : '';
            categories.forEach(category => {
                $("#message-feedback-" + category['category_eng']).val(category['feedback']);
            })
            $("#total-feedback").val(total_feedback)
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    function save_draft() {
        send_request(false, true);
        save_to_storage();
    }

    function submit() {
        send_request(true, true);
        if (typeof (Storage) !== "undefined") {
            localStorage.removeItem([courseid + "/" + taskid + "/" + current_student]);
        } else {
            alert("Your browser doesn't support web storage");
        }
    }

    function make_preview() {
        send_request(false, false);
        save_to_storage();
    }


    function send_request(is_final_version, is_for_save) {
        categories.forEach(category => {
            category['checked'] = displayedSections.includes("feedback-" + category["category_eng"]);
            category['tests'].forEach( test => {
                test['checked'] = displayedSections.includes(test['name']);
            })
        });
        $.ajax({
                type: "POST",
                url: window.location.href,
                data: JSON.stringify({
                    "categories": categories,
                    "total_feedback": total_feedback,
                    "is_final_version": is_final_version,
                    "is_for_save": is_for_save,
                }),
                success: function(data) {
                    console.log("success");
                    var html = data;
                    $("#draft").html(html);
                },
                error: function (e) {
                    console.log(e)
                },
        });
    }

    function renderGitlabRows(feedback_data) {
        var scenario_row;
        console.log('here is feedbackData from Gitlab');
        console.log(feedback_data);


        feedback_data.forEach(data => {
                console.log('here is feedback category data');
                data['id'] = data['category_eng'];
                scenario_row = $(tmpl('tmpl-category', data));
                $('.print-head').hide()
                $('#scenarios-table-' + taskid).append(scenario_row);
        });

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


