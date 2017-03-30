var englishDaysLabel = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var daysLabel = (lang_user == 'fr-FR')
                ? ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
                : englishDaysLabel;
var craExists = false;
var openDaysCount = 0;
var selectCount = 0;
var globalData;

function daysOfMonth(month, year) {
    var date = new Date(year, month, 1);
    var days = [];
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }

    return days;
}

function isDayOpen(day, settings, exceptions) {
    if (!settings) {
        $(".craBlocks").hide();
        return $("#noSettings").show();
    }
    if (!settings['f_'+englishDaysLabel[day.getDay()].toLowerCase()])
        return false;
    var dayCopy = new Date(day);
    dayCopy.setHours(0,0,0,0);
    for (var i = 0; i < exceptions.length; i++) {
        var exceptionDate = new Date(exceptions[i].f_date);
        exceptionDate.setHours(0,0,0,0);
        if (dayCopy.getTime() == exceptionDate.getTime())
            return false;
    }

    openDaysCount++;
    return true;
}

function generateTotalRow(days) {
    var row = '<tr><td style="text-align:right;">Total</td>';
    for (var i = 0; i < days.length; i++)
        row += '<td>0</td>';
    row += '</tr>';
    return row;
}

function generateAddActivityRow(data) {
    openDaysCount = 0;
    var days = daysOfMonth(data.month-1, data.year);
    var newSelect = $("#activitiesSelect").find('select').clone().attr('name', "select."+(++selectCount));
    var row = "<tr><td></td>";
    var j = -1;
    while (++j < days.length)
        row += isDayOpen(days[j], data.team.r_cra_calendar_settings, data.team.r_cra_calendar_exception)
                        ? '<td><input class="openDay taskInput" name="task.activityIDplaceholder.'+days[j].getDate()+'" disabled style="max-width:20px;margin: 0; padding: 0;"></td>'
                        : '<td><input class="taskInput" name="task.activityIDplaceholder.'+days[j].getDate()+'" style="margin: 0; padding: 0;max-width:20px;" disabled></td>';
    row += '</tr>';
    // No default activity, only total tr in tbody (prev().after() won't work)
    if ($("#craTable").find('tr').length == 2) {
        $("#craTable tbody").prepend(row);
        $("#craTable tbody tr:last").prev().find('td:first').html(newSelect);
        $("#craTable tbody tr:last").prev().find('td:first select').removeClass('select2-hidden-accessible');
    }
    // With default activity, tbody already filled
    else {
        $("#craTable tbody tr:last").prev().after(row);
        $("#craTable tbody tr:last").prev().find('td:first').html(newSelect);
        $("#craTable tbody tr:last").prev().find('td:first select').removeClass('select2-hidden-accessible');
    }
}

function generateEmptyCRA(data) {
    var days = daysOfMonth(data.month-1, data.year);
    var craTable = '';
    craTable += '<table id="craTable" class="small-font table-responsive table dataTable table-striped"><thead><tr><th>Activity</th>';

    // Header with "day - date"
    for (var i = 0; i < days.length; i++) {
        craTable += "<th>"+daysLabel[days[i].getDay()].substring(0,3)+" "+days[i].getDate()+'</th>';
    }
    craTable += '</tr></thead><tbody>';

    // Activities
    for (var i = 0; i < data.team.r_default_cra_activity.length; i++) {
        openDaysCount = 0;
        craTable += '<tr><td>'+data.team.r_default_cra_activity[i].f_name+'</td>';
        var j = -1;
        while (++j < days.length)
            craTable += isDayOpen(days[j], data.team.r_cra_calendar_settings, data.team.r_cra_calendar_exception)
                            ? '<td><input class="small-font openDay taskInput" name="task.'+data.team.r_default_cra_activity[i].id+'.'+days[j].getDate()+'" style="max-width:20px;margin: 0; padding: 0;"></td>'
                            : '<td><input class="small-font taskInput" name="task.'+data.team.r_default_cra_activity[i].id+'.'+days[j].getDate()+'" style="margin: 0; padding: 0;max-width:20px;" disabled></td>';

        craTable += '</tr>';
    }

    craTable += generateTotalRow(days);
    craTable += '</tbody></table>';
    return craTable;
}

function generateExistingCRA(data) {
    openDaysCount = 0;
    var days = daysOfMonth(data.month-1, data.year);
    var craTable = '';
    craTable += '<table id="craTable" class="small-font table-responsive table dataTable table-striped"><thead><tr><th>Activity</th>';

    // Header with "day - date"
    for (var i = 0; i < days.length; i++) {
        craTable += "<th>"+daysLabel[days[i].getDay()].substring(0,3)+" "+days[i].getDate()+'</th>';
    }
    craTable += '</tr></thead><tbody>';

    var knownActivities = [];
    for (var i = 0; i < data.cra.r_cra_task.length; i++)
        if (!knownActivities[data.cra.r_cra_task[i].f_id_cra_activity])
            knownActivities[data.cra.r_cra_task[i].f_id_cra_activity] = data.cra.r_cra_task[i].r_cra_activity;
    for (var i = 0; i < data.team.r_default_cra_activity.length; i++)
        if (!knownActivities[data.team.r_default_cra_activity[i].id])
            knownActivities[data.team.r_default_cra_activity[i].id] = data.team.r_default_cra_activity[i];

    for (var acty in knownActivities) {
        openDaysCount = 0;
        craTable += '<tr><td>'+knownActivities[acty].f_name+'</td>';
        var j = -1;
        while (++j < days.length) {
            var taskExists = false;
            for (var k = 0; k < data.cra.r_cra_task.length; k++) {
                var task = data.cra.r_cra_task[k];
                if (task.f_id_cra_activity == knownActivities[acty].id) {
                    var date = new Date(task.f_date);
                    if (date.getDate() == days[j].getDate()) {
                        taskExists = true;
                        craTable += isDayOpen(days[j], data.team.r_cra_calendar_settings, data.team.r_cra_calendar_exception)
                                    ? '<td><input class="small-font openDay taskInput" name="task.'+knownActivities[acty].id+'.'+days[j].getDate()+'" value="'+task.f_duration+'" style="max-width:20px;margin: 0; padding: 0;"></td>'
                                    : '<td><input class="small-font taskInput" name="task.'+knownActivities[acty].id+'.'+days[j].getDate()+'" value="'+task.f_duration+'" style="max-width:20px;margin: 0; padding: 0;" disabled></td>';
                        break;
                    }
                }
            }
            if (!taskExists)
                craTable += isDayOpen(days[j], data.team.r_cra_calendar_settings, data.team.r_cra_calendar_exception)
                            ? '<td><input class="small-font openDay taskInput" name="task.'+knownActivities[acty].id+'.'+days[j].getDate()+'" style="max-width:20px;margin: 0; padding: 0;"></td>'
                            : '<td><input class="small-font taskInput" name="task.'+knownActivities[acty].id+'.'+days[j].getDate()+'" style="max-width:20px;margin: 0; padding: 0;" disabled></td>';
        }
        craTable += '</tr>';
    }

    craTable += generateTotalRow(days);
    craTable += '</tbody></table>';
    return craTable;
}

function showButtonGroup(userValid, adminValid){
    $(".craButtonGroup").hide();
    if (!userValid && !adminValid && !craExists)
        $("#save").show();
    else if (!adminValid && craExists)
        $("#modifyValidate").show();
    else if (userValid && adminValid)
        $("#export").show();

    if (userValid)
        $("#userValidIcon").addClass('fa-check-square-o').removeClass('fa-square-o');
    else
        $("#userValidIcon").addClass('fa-square-o').removeClass('fa-check-square-o');
    if (adminValid) {
        $(".openDay").prop('disabled', true);
        $("#adminValidIcon").addClass('fa-check-square-o').removeClass('fa-square-o');
    }
    else
        $("#adminValidIcon").addClass('fa-square-o').removeClass('fa-check-square-o');
}

$(function() {
    // Initialize datepicker and bind change event
    $("#monthYearPicker").datepicker({
        format: 'mm-yyyy',
        startView: 'months',
        minViewMode: 'months',
        defaultDate: new Date()
    }).on('changeDate', function(event) {
        var month = event.date.getMonth()+1;
        var year = event.date.getFullYear();
        // Look for exisiting data for month/year
        $.ajax({
            url: '/cra/getData/'+month+'/'+year,
            success: function(data) {
                globalData = data;
                // Display information divs if required
                if (data.activities.length == 0) {
                    $(".craBlocks").hide();
                    return $("#noActivities").show();
                }

                // Global vars
                craExists = data.craExists;

                data.month = month;
                data.year = year;
                // CRA already exists
                if (data.craExists) {
                    $("notificationAdmin").text(data.cra.f_notification_admin || '');
                    $("#notificationAdminToPrint").text(data.cra.f_notification_admin);
                    $("#craForm").attr('action', '/cra/declare/update');
                    $("#validateButton").data('url', '/cra/declare/validate/'+data.cra.id);
                    $("#cra").html(generateExistingCRA(data));
                    if (!data.cra.f_admin_validated)
                        generateAddActivityRow(data);
                    showButtonGroup(data.cra.f_user_validated, data.cra.f_admin_validated, true);
                    $("#export").find('a').attr('href',$("#export").find('a').attr('href')+data.cra.id);
                }
                // CRA doesn't exists
                else {
                    $("notificationAdmin").text('');
                    $("#craForm").attr('action', '/cra/declare/create');
                    $("#cra").html(generateEmptyCRA(data));
                    generateAddActivityRow(data);
                    showButtonGroup(false, false, false);
                }

                // Add month and year to form data
                $("input[name=month]").val(month);
                $("input[name=year]").val(year);

                // Display table as a datatable
                $("#craTable").DataTable({
                    responsive: true,
                    bPaginate: false,
                    bAutoWidth: false,
                    bFilter: false,
                    bInfo: false,
                    ordering: false,
                    scrollX: true
                });

                // Trigger each row total calculation
                $("#craTable").find("tr:nth-child(2)").find('.taskInput').each(function(){
                    $(this).trigger('keyup');
                });
            },
            error: function(err, st, rest) {
                toastr.error(err.responseText);
            }
        });
    });
    // Set default date
    $("#monthYearPicker").datepicker('setDate', new Date());

    // Bind previous and next button to change datepicker and display
    $("#previous, #next").click(function() {
        var currentDate = $("#monthYearPicker").datepicker('getDate');
        if ($(this).attr('id') == 'previous')
            currentDate.setMonth(currentDate.getMonth()-1);
        else if ($(this).attr('id') == 'next')
            currentDate.setMonth(currentDate.getMonth()+1);
        $("#monthYearPicker").datepicker('setDate', currentDate);
    });

    // Create/Update C.R.A tasks
    $("#craForm").on('submit', function() {
        $.ajax({
            url: $(this).attr('action'),
            method: $(this).attr('method'),
            data: $(this).serialize(),
            success:function(data) {
                if (craExists)
                    toastr.success('message.update.success');
                else
                    toastr.success('message.create.success');
                if (data.action == 'created') {
                    $("#validateButton").data('url', '/cra/declare/validate/'+data.id_cra);
                    craExists = true;
                }
                $("#monthYearPicker").datepicker('setDate', $("#monthYearPicker").datepicker('getDate'));
            }
        });

        return false;
    });

    $(document).delegate('.taskInput', 'keyup', function() {
        var self = this;
        var tdIndex = $(self).parents('tr').find('td').index($(self).parents('td'));
        var count = 0;
        // Calculate column's total
        $(self).parents('table').find('tr:not(:first):not(:last)').each(function(){
            var rowInput = $(this).find('td').eq(tdIndex).find('input');
            var inputVal = rowInput.val().replace(/,/, '.');
            if (!isNaN(parseFloat(inputVal)))
                count += parseFloat(inputVal);
        });

        // Color red if column total is superior to one (one day)
        if (count > 1) {
            $("#save, #modifyValidate").find('button').addClass('disabled');
            $(self).parents('table').find('tr:last').find('td').eq(tdIndex).css('color', 'red');
        }
        else {
            $("#save, #modifyValidate").find('button').removeClass('disabled');
            $(self).parents('table').find('tr:last').find('td').eq(tdIndex).css('color', 'initial');
        }

        // Set column's total to total row
        $(self).parents('table').find('tr:last').find('td').eq(tdIndex).html(count);

        // Calculate global total
        var totalCount = 0;
        $(self).parents('table').find('tr:last>td:not(:first)').each(function() {
            var columnTotal = $(this).html().replace(/,/, '.');
            if (!isNaN(parseFloat(columnTotal)))
                totalCount += parseFloat(columnTotal);
        });
        $(self).parents('table').find('tr:last>td:first').html("Total : "+totalCount+'/'+openDaysCount);
    });

    // Validate CRA
    $("#validateButton").click(function() {
        $.ajax({
            url: $(this).data('url'),
            success: function(data) {
                showButtonGroup(true, false);
                toastr.success('Validation successful');
            },
            error: function(err, st, rest) {
                toastr.error(err.responseText);
            }
        });
        return false;
    });

    $(document).delegate('.activitiesSelect', 'change', function() {
        var self = this;
        var selectValue = $(self).find(':selected').val();

        if ($("input[name^='task."+selectValue+"'").length > 0) {
            $(self).prop('selectedIndex', 0);
            return;
        }

        var numberOfEmpty = 0;var isAlreadySelected = 0;
        for (var i = 0; i < $('.activitiesSelect').length; i++)
            if ($('.activitiesSelect').eq(i).find(':selected').val() == '0')
                numberOfEmpty++;
        // Add activity row if needed
        if (numberOfEmpty == 1)
            generateAddActivityRow(globalData);

        // Activity deletion
        if (selectValue == '0')
            $(self).parents('tr').remove();
        // Enable row's inputs, set input's name with activity ID
        else {
            console.log('Salut ?');
            $(self).parents('tr').find('.openDay').prop('disabled', false);
            $(self).parents('tr').find('.taskInput').each(function() {
                var inputName = $(this).attr('name');
                var parts = inputName.split('.');
                inputName = parts[0]+'.'+selectValue+'.'+parts[2];
                $(this).attr('name', inputName);
            });
        }
    });
});