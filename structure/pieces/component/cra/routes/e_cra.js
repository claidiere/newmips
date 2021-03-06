var express = require('express');
var router = express.Router();
var block_access = require('../utils/block_access');
var dust = require('dustjs-linkedin');
var pdf = require('html-pdf');
var fs = require('fs-extra');
var entity_helper = require('../utils/entity_helper');
var moment = require('moment');

// Datalist
var filterDataTable = require('../utils/filter_datatable');

// Sequelize
var models = require('../models/');
var attributes = require('../models/attributes/e_cra');
var options = require('../models/options/e_cra');
var model_builder = require('../utils/model_builder');

// Enum and radio managment
var enums_radios = require('../utils/enum_radio.js');

// Winston logger
var logger = require('../utils/logger');

function teamAdminMiddleware(req, res, next) {
    models.E_cra_team.findOne({
        where: {fk_id_admin_user: req.session.passport.user.id},
        include: [{
            model: models.E_user,
            as: 'r_user'
        }]
    }).then(function(team) {
        req.isAdmin = true;
        if (!team) {
            if(req.originalUrl == "/cra/list" || req.originalUrl == "/cra/datalist")
                req.isAdmin = false;
            else if (req.originalUrl == '/cra/declare' && req.session.passport.user.r_group.f_label != 'admin')
                req.isAdmin = true;
            else {
                req.session.toastr.push({level: 'error', message: 'entity.e_cra_team.admin_only'});
                return res.redirect('/default/cra');
            }
        }
        else
            req.team = team;
        next();
    });
}

function getValue(itemPath, data, scope) {
    try {
        var i = 0;
        var key = itemPath[i];
        if (scope && scope.scopePath &&
            scope.scopePathItem &&
            scope.scopePath.length &&
            scope.scopePath.length === scope.scopePathItem.length) {
            //Go to data scope  before search value
            for (var j = 0; j < scope.scopePath.length; j++)
                data = data[scope.scopePath[j]][scope.scopePathItem[j]];
        }
        do {
            if (data != null && typeof data !== "undefined" && typeof data[key] !== 'undefined') {
                data = data[key];
            } else
                return '';
            i++;
            key = itemPath[i];
        } while (i < itemPath.length);
        if(data == null)
            data = "";
        return data;
    } catch (e) {
        return '';
    }
};

function generateDocxDoc(options) {
    return new Promise(function(resolve, reject) {
        fs.readFile(options.file, function(err, content) {
            if (!err) {
                var JSZip = require('jszip');
                var Docxtemplater = require('docxtemplater');
                try {
                    var zip = new JSZip(content);
                    var doc = new Docxtemplater();
                    var templateOptions = {
                        nullGetter: function(part, scope) {
                            if (part && part.value) {
                                var parts = part.value.split('.');
                                if (parts.length)
                                    return getValue(parts, options.data, scope);
                                return "";
                            }
                            return "";
                        }
                    };
                    doc.setOptions(templateOptions);
                    doc.loadZip(zip);
                    doc.setData(options.data);
                    try {
                        doc.render();
                        var buf = doc.getZip().generate({
                            type: 'nodebuffer',
                            compression: "DEFLATE"
                        });
                        resolve({
                            buffer: buf,
                            contentType: "application/msword",
                            ext: '.docx'
                        });
                    } catch (error) {
                        reject(error);
                    }
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(new Error("Template not found."));
            }
        });
    });
};

router.get('/list', teamAdminMiddleware, block_access.actionAccessMiddleware("cra", "read"), function (req, res) {
    var data = {
        "menu": "e_cra",
        "sub_menu": "list_e_cra",
        isAdmin: req.isAdmin || req.session.passport.user.r_group.f_label == 'admin'
    };

    // Team admin
    if(req.isAdmin){
        // Get cra waiting to be validated for first list of page
        var idTeamUsers = [];
        for (var i = 0; i < req.team.r_user.length; i++)
            idTeamUsers.push(req.team.r_user[i].id);

        models.E_cra.findAll({
            where: {
                fk_id_user: {$in: idTeamUsers},
                f_admin_validated: false,
                f_user_validated: true
            }
        }).then(function(cra) {
            data.cra = cra;
            data.users = req.team.r_user;

            res.render('e_cra/list', data);
        });
    }
    // Global admin
    else if (data.isAdmin) {
        models.E_cra.findAll({
            where: {
                f_admin_validated: false,
                f_user_validated: true
            }
        }).then(function(cra) {
            data.cra = cra;
            models.E_user.findAll().then(function(users) {
                data.users = users;
                res.render('e_cra/list', data);
            });
        });
    }
    else {
        data.noAdmin = true;
        res.render('e_cra/list', data);
    }
});

router.post('/datalist', teamAdminMiddleware, block_access.actionAccessMiddleware("cra", "read"), function (req, res) {
    var where = {};
    if(req.isAdmin){
        var idTeamUsers = [];
        for (var i = 0; i < req.team.r_user.length; i++)
            idTeamUsers.push(req.team.r_user[i].id);

        where = {
            fk_id_user: {$in: idTeamUsers}
        }
    }
    // if admin, no speWhere parameter, all cra fetched
    else if (req.session.passport.user.r_role.f_label != 'admin') {
        where = {
            fk_id_user: req.session.passport.user.id
        }
    }

    filterDataTable("E_cra", req.body, null, where).then(function (rawData) {
        entity_helper.prepareDatalistResult('e_cra', rawData, req.session.lang_user).then(function (preparedData) {
            res.send(preparedData).end();
        }).catch(function (err) {
            console.error(err);
            logger.debug(err);
            res.end();
        });
    }).catch(function (err) {
        console.error(err);
        logger.debug(err);
        res.end();
    });
});

router.post('/fieldset/:alias/remove', block_access.actionAccessMiddleware("cra", "delete"), function (req, res) {
    var alias = req.params.alias;
    var idToRemove = req.body.idRemove;
    var idEntity = req.body.idEntity;
    models.E_cra.findOne({where: {id: idEntity}}).then(function (e_cra) {
        if (!e_cra) {
            var data = {error: 404};
            return res.render('common/error', data);
        }

        // Get all associations
        e_cra['get' + entity_helper.capitalizeFirstLetter(alias)]().then(function (aliasEntities) {
            // Remove entity from association array
            for (var i = 0; i < aliasEntities.length; i++)
                if (aliasEntities[i].id == idToRemove) {
                    aliasEntities.splice(i, 1);
                    break;
                }

            // Set back associations without removed entity
            e_cra['set' + entity_helper.capitalizeFirstLetter(alias)](aliasEntities).then(function () {
                res.sendStatus(200).end();
            });
        });
    }).catch(function (err) {
        entity_helper.error(err, req, res);
    });
});

router.post('/fieldset/:alias/add', block_access.actionAccessMiddleware("cra", "create"), function (req, res) {
    var alias = req.params.alias;
    var idEntity = req.body.idEntity;
    models.E_cra.findOne({where: {id: idEntity}}).then(function (e_cra) {
        if (!e_cra) {
            var data = {error: 404};
            logger.debug("No data entity found.");
            return res.render('common/error', data);
        }

        var toAdd;
        if (typeof (toAdd = req.body.ids) === 'undefined') {
            req.session.toastr.push({
                message: 'message.create.failure',
                level: "error"
            });
            return res.redirect('/cra/show?id=' + idEntity + "#" + alias);
        }

        e_cra['add' + entity_helper.capitalizeFirstLetter(alias)](toAdd).then(function () {
            res.redirect('/cra/show?id=' + idEntity + "#" + alias);
        });
    }).catch(function (err) {
        entity_helper.error(err, req, res);
    });
});

router.get('/admin', teamAdminMiddleware, block_access.actionAccessMiddleware("cra", 'read'), function(req, res) {
    var data = {
        menu: "e_cra",
        sub_menu: "list_e_cra"
    };

    var id_cra = req.query.id;
    models.E_user.findOne({
        include: [{
            model: models.E_cra,
            as: 'r_cra',
            where: {id: id_cra}
        }]
    }).then(function(user) {
        if (!user)
            return entity_helper.error("Unable to find associated user", req, res);
        data.user = user;
        models.E_cra_activity.findAll({where: {f_active: true}}).then(function(activities) {
            models.E_cra_team.findOne({
                include: [{
                    model: models.E_user,
                    as: 'r_user',
                    where: {id: user.id}
                }, {
                    model: models.E_cra_activity,
                    as: 'r_default_cra_activity'
                }]
            }).then(function(team) {
                if (!team){
                    data.noTeam = true;
                    return res.render('e_cra/declare', data);
                }
                for (var i = 0; i < team.r_default_cra_activity.length; i++)
                    for (var j = 0; j < activities.length; j++)
                        if (team.r_default_cra_activity[i].id == activities[j].id)
                            activities.splice(j, 1);
                data.activities = activities;
                res.render('e_cra/admin_declare', data);
            });
        });
    });
});

router.get('/admin/validate/:id', teamAdminMiddleware, block_access.actionAccessMiddleware("cra", 'create'), function(req, res) {
    var id_cra = req.params.id;

    models.E_cra.findById(id_cra).then(function(cra) {
        if (!cra)
            return res.status(404).send("Couldn't find CRA");
        if (!cra.f_user_validated)
            return res.status(404).send("User must validate first");

        cra.update({f_admin_validated: true}).then(function() {
            res.status(200).end();
        });
    }).catch(function(err) {
        res.status(500).send("Couldn't validate CRA");
    });
});

router.post('/admin/update', teamAdminMiddleware, block_access.actionAccessMiddleware("cra", 'update'), function(req, res) {
    var body = req.body;
    var id_cra = parseInt(body.id_cra);

    models.E_cra.findOne({
        where: {id: id_cra},
        include: [{
            model: models.E_cra_task,
            as: 'r_cra_task',
            include: [{
                model: models.E_cra_activity,
                as: 'r_cra_activity'
            }]
        }]
    }).then(function(cra) {
        if (!cra)
            return res.status(500).send("Couldn't find previously saved Timesheet");

        if (cra.f_user_validated && cra.f_admin_validated)
            return res.status(403).send("You can't update if admin validated");

        var updateDeleteTasksPromises = [];
        var createTasksPromises = [];
        var matchedTasks = [];
        for (var input in body) {
            var parts = input.split('.');
            if (parts[0] !== 'task' || body[input] == '' || body[input] == '0')
                continue;
            var activityId = parts[1];
            var formDate = new Date(cra.f_year, cra.f_month-1, parts[2]);
            var taskExists = false;
            for (var i = 0; i < cra.r_cra_task.length; i++) {
                if (cra.r_cra_task[i].fk_id_cra_activity == activityId) {
                    var taskDate = new Date(cra.r_cra_task[i].f_date);
                    if (taskDate.getDate() == formDate.getDate()) {
                        taskExists = true;
                        matchedTasks.push(cra.r_cra_task[i].id);
                        updateDeleteTasksPromises.push(cra.r_cra_task[i].update({f_duration: body[input]}));
                        break;
                    }
                }
            }
            if (!taskExists)
                createTasksPromises.push(models.E_cra_task.create({
                    f_date: formDate,
                    f_duration: body[input],
                    fk_id_cra: cra.id,
                    fk_id_cra_activity: activityId
                }));
        }

        Promise.all(createTasksPromises).then(function(tasks) {
            for (var i = 0; i < tasks.length; i++)
                matchedTasks.push(tasks[i].id);
            // Delete replaced (not changed) tasks
            updateDeleteTasksPromises.push(models.E_cra_task.destroy({
                where: {
                    id: {$notIn: matchedTasks},
                    fk_id_cra: cra.id
                }})
            );
            Promise.all(updateDeleteTasksPromises).then(function() {
                res.status(200).json({user_validated: cra.f_user_validated, admin_validated: false});
                cra.update({f_admin_validated: false, f_notification_admin: body.notificationAdmin});
            });
        });
    }).catch(function(err) {
        console.error(err);
        return res.status(500).send("Unable to update your Activity report");
    });
});

router.get('/admin/getCra', block_access.actionAccessMiddleware("cra", 'read'), function(req, res) {
    var data = {
        menu: "e_cra",
        sub_menu: "list_e_cra"
    };

    var id_cra = req.query.id;
    models.E_cra.findOne({
        where: {id: id_cra},
        include: [{
            model: models.E_cra_task,
            as: 'r_cra_task',
            include: [{
                model: models.E_cra_activity,
                as: 'r_cra_activity'
            }]
        }]
    }).then(function(cra) {
        if (!cra)
            data.craExists = false;
        else {
            data.craExists = true;
            data.cra = cra;
        }
        models.E_cra_activity.findAll().then(function(activities) {
            data.activities = activities;
            models.E_cra_team.findOne({
                include: [{
                    model: models.E_user,
                    as: 'r_user',
                    where: {id: cra.fk_id_user}
                }, {
                    model: models.E_cra_calendar_settings,
                    as: 'r_cra_calendar_settings'
                }, {
                    model: models.E_cra_calendar_exception,
                    as: 'r_cra_calendar_exception'
                }, {
                    model: models.E_cra_activity,
                    as: 'r_default_cra_activity'
                }]
            }).then(function(team) {
                if (!team)
                    return res.status(500).send("You need to be in a team");
                data.team = team;
                res.status(200).json(data);
            })
        });
    });
});

router.get('/declare', block_access.actionAccessMiddleware("cra", 'read'), function(req, res) {
    var data = {
        menu: "e_cra",
        sub_menu: "create_e_cra"
    };

    var userId;
    if (req.query.idUser) {
        userId = req.query.idUser
        data.declareForUserId = userId;
    }
    else
        userId = req.session.passport.user.id;

    models.E_cra_activity.findAll({where: {f_active: true}}).then(function(activities) {
        models.E_cra_team.findOne({
            include: [{
                model: models.E_user,
                as: 'r_user',
                where: {id: userId}
            }, {
                model: models.E_cra_activity,
                as: 'r_default_cra_activity'
            }]
        }).then(function(team) {
            if (!team){
                data.noTeam = true;
                return res.render('e_cra/declare', data);
            }

            // Remove activity that are in team default activity
            for (var i = 0; i < team.r_default_cra_activity.length; i++)
                for (var j = 0; j < activities.length; j++)
                    if (team.r_default_cra_activity[i].id == activities[j].id)
                        activities.splice(j, 1);

            data.activities = activities;
            res.render('e_cra/declare', data);
        });
    });
});

router.get('/getCra', block_access.actionAccessMiddleware("cra", 'read'), function(req, res) {
    var data = {
        menu: "e_cra",
        sub_menu: "list_e_cra"
    };

    var id_cra = req.query.id;
    models.E_user.findOne({
        include: [{
            model: models.E_cra,
            as: 'r_cra',
            where: {id: id_cra}
        }]
    }).then(function(user) {
        if (!user)
            return entity_helper.error("Unable to find associated user", req, res);
        data.user = user;
        models.E_cra_activity.findAll({where: {f_active: true}}).then(function(activities) {
            models.E_cra_team.findOne({
                include: [{
                    model: models.E_user,
                    as: 'r_user',
                    where: {id: user.id}
                }, {
                    model: models.E_cra_activity,
                    as: 'r_default_cra_activity'
                }]
            }).then(function(team) {
                if (!team){
                    data.noTeam = true;
                    return res.render('e_cra/declare', data);
                }
                for (var i = 0; i < team.r_default_cra_activity.length; i++)
                    for (var j = 0; j < activities.length; j++)
                        if (team.r_default_cra_activity[i].id == activities[j].id)
                            activities.splice(j, 1);
                data.activities = activities;

                // Send year and month to dust to instanciate the good date on the CRA
                data.yearCRA = user.r_cra[0].f_year;
                data.monthCRA = user.r_cra[0].f_month;
                res.render('e_cra/declare', data);
            });
        });
    });
});

router.get('/declare/validate/:id_cra', block_access.actionAccessMiddleware("cra", 'create'), function(req, res) {
    var id_cra = parseInt(req.params.id_cra);

    models.E_cra.update({f_user_validated: true}, {where: {id: id_cra}}).then(function(cra) {
        if (!cra)
            return res.status(404).send("Couldn't find Timesheet with id "+id_cra);
        res.status(200).end();
    }).catch(function(err) {
        console.error(err);
        return res.status(404).send("Couldn't update");
    });
});

router.post('/declare/create', block_access.actionAccessMiddleware("cra", 'create'), function(req, res) {
    var body = req.body;
    body.year = parseInt(body.year);
    body.month = parseInt(body.month);
    var id_user = req.body.declareForUserId ? req.body.declareForUserId : req.session.passport.user.id;

    models.E_cra.create({
        f_month: body.month,
        f_year: body.year,
        fk_id_user: id_user,
        f_user_validated: false,
        f_admin_validated: false
    }).then(function(cra) {
        var tasksPromises = [];
        for (var input in body) {
            var parts = input.split('.');
            if (parts[0] !== 'task' || body[input] == '' || body[input] == '0')
                continue;
            var activityId = parts[1];
            var date = new Date(body.year, body.month-1, parts[2]);
            tasksPromises.push(models.E_cra_task.create({
                f_date: date,
                f_duration: body[input],
                fk_id_cra: cra.id,
                fk_id_cra_activity: activityId
            }));
        }

        Promise.all(tasksPromises).then(function() {
            res.status(200).json({id_cra: cra.id, action: 'created', user_validated: false, admin_validated: false});

            // Calculate and update open days count of CRA
            models.E_cra_team.findOne({
                include: [{
                    model: models.E_user,
                    as: 'r_user',
                    where: {id: id_user}
                }, {
                    model: models.E_cra_calendar_settings,
                    as: 'r_cra_calendar_settings'
                }, {
                    model: models.E_cra_calendar_exception,
                    as: 'r_cra_calendar_exception'
                }]
            }).then(function(team) {
                var date = new Date(body.year, body.month-1, 1);
                var days = [];
                while (date.getMonth() === body.month-1) {
                    days.push(new Date(date));
                    date.setDate(date.getDate()+1);
                }

                var openDays = days.length;
                var labels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                for (var i = 0; i < days.length; i++) {
                    days[i].setHours(0,0,0,0);
                    if (team.r_cra_calendar_settings['f_'+labels[days[i].getDay()].toLowerCase()] == false) {
                        openDays--;
                        continue;
                    }
                    for (var j = 0; j < team.r_cra_calendar_exception.length; j++) {
                        var excepDate = new Date(team.r_cra_calendar_exception[j].f_date);
                        excepDate.setHours(0,0,0,0);
                        if (excepDate.getTime() == days[i].getTime()) {
                            openDays--;
                            continue;
                        }
                    }
                }

                cra.update({f_open_days_in_month: openDays});
            })
        }).catch(function(err) {
            return res.status(500).send("Can't create your Timesheet");
        });
    });
});

router.post('/declare/update', block_access.actionAccessMiddleware("cra", 'update'), function(req, res) {
    var body = req.body;
    body.year = parseInt(body.year);
    body.month = parseInt(body.month);
    var id_user = req.body.declareForUserId ? req.body.declareForUserId : req.session.passport.user.id;

    models.E_cra.findOne({
        where: {
            f_month: body.month,
            f_year: body.year,
            fk_id_user: id_user
        },
        include: [{
            model: models.E_cra_task,
            as: 'r_cra_task',
            include: [{
                model: models.E_cra_activity,
                as: 'r_cra_activity'
            }]
        }]
    }).then(function(cra) {
        if (!cra)
            return res.status(500).send("Couldn't find previously saved Timesheet");

        if (cra.f_user_validated && cra.f_admin_validated)
            return res.status(403).send("You can't update if admin validated");

        var tasksPromises = [];
        var matchedTasks = [];
        for (var input in body) {
            var parts = input.split('.');
            if (parts[0] !== 'task' || body[input] == '' || body[input] == '0')
                continue;
            var activityId = parts[1];
            var formDate = new Date(body.year, body.month-1, parts[2]);
            var taskExists = false;
            for (var i = 0; i < cra.r_cra_task.length; i++) {
                if (cra.r_cra_task[i].fk_id_cra_activity == activityId) {
                    var taskDate = new Date(cra.r_cra_task[i].f_date);
                    if (taskDate.getDate() == formDate.getDate()) {
                        taskExists = true;
                        matchedTasks.push(cra.r_cra_task[i].id);
                        tasksPromises.push(cra.r_cra_task[i].update({f_duration: body[input]}));
                        break;
                    }
                }
            }
            if (!taskExists)
                tasksPromises.push(models.E_cra_task.create({
                    f_date: formDate,
                    f_duration: body[input],
                    fk_id_cra: cra.id,
                    fk_id_cra_activity: activityId
                }));
        }

        // Delete replaced (not changed) tasks
        tasksPromises.push(models.E_cra_task.destroy({
            where: {
                id: {$notIn: matchedTasks},
                fk_id_cra: cra.id
            }})
        );

        Promise.all(tasksPromises).then(function() {
            res.status(200).json({action: 'updated', user_validated: false, admin_validated: cra.f_admin_validated});
            cra.update({f_user_validated: false});
        });
    }).catch(function(err) {
        console.error(err);
        return res.status(500).send("Unable to update your Activity report");
    });
});

router.get('/getData/:month/:year/:forUserId*?', block_access.actionAccessMiddleware("cra", 'read'), function(req, res) {
    var data = {};
    var id_user = req.params.forUserId ? req.params.forUserId : req.session.passport.user.id;
    var month = parseInt(req.params.month);
    var year = parseInt(req.params.year);

    models.E_cra.findOne({
        where: {
            fk_id_user: id_user,
            $and: [
                {f_month: month},
                {f_year: year}
            ]
        },
        include: [{
            model: models.E_cra_task,
            as: 'r_cra_task',
            include: [{
                model: models.E_cra_activity,
                as: 'r_cra_activity'
            }]
        }]
    }).then(function(cra) {
        if (!cra)
            data.craExists = false;
        else {
            data.craExists = true;
            data.cra = cra;
        }
        models.E_cra_activity.findAll().then(function(activities) {
            data.activities = activities;
            models.E_cra_team.findOne({
                include: [{
                    model: models.E_user,
                    as: 'r_user',
                    where: {id: id_user}
                }, {
                    model: models.E_cra_calendar_settings,
                    as: 'r_cra_calendar_settings'
                }, {
                    model: models.E_cra_calendar_exception,
                    as: 'r_cra_calendar_exception'
                }, {
                    model: models.E_cra_activity,
                    as: 'r_default_cra_activity'
                }]
            }).then(function(team) {
                if (!team)
                    return res.status(500).send("You need to be in a team");
                data.team = team;
                data.isTeamAdmin = (team.fk_id_admin_user == id_user) ? true : false;
                res.status(200).json(data);
            })
        });
    });
});

router.get('/export/:id', block_access.actionAccessMiddleware("cra", "read"), function (req, res) {
    var id_cra = req.params.id;

     models.E_user.findOne({
        include: [{
            model: models.E_cra,
            as: 'r_cra',
            where: {id: id_cra},
            include: [{
                model: models.E_cra_task,
                as: 'r_cra_task',
                include: [{
                    model: models.E_cra_activity,
                    as: 'r_cra_activity'
                }]
            }]
        }]
    }).then(function(user) {
        var cra = user.r_cra[0];
        var workedDays = 0.;
        var activitiesById = [];
        // Organize array with activity > tasks instead of tasks > activity
        for (var i = 0; i < cra.r_cra_task.length; i++) {
            var task = cra.r_cra_task[i];
            if (typeof activitiesById[task.fk_id_cra_activity] === 'undefined') {
                activitiesById[task.fk_id_cra_activity] = task.r_cra_activity;
                activitiesById[task.fk_id_cra_activity].tasks = [];
            }
            activitiesById[task.fk_id_cra_activity].tasks.push(task);
        }

        var totalDays = new Date(cra.f_year, cra.f_month, 0).getDate();
        var activities = [];var daysAndLabels = [];
        var daysLabels = (req.session.lang_user == 'fr-FR')
                ? ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
                : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        for (var acti in activitiesById) {
            var i = 0;
            activitiesById[acti].filledTasks = [];
            activitiesById[acti].rowTotal = 0;
            while (i++ < totalDays) {
                var tmp = new Date(cra.f_year, cra.f_month-1, i);
                if (daysAndLabels.length < totalDays)
                    daysAndLabels.push({f_date: i, f_day: daysLabels[tmp.getDay()].substring(0, 3)})
                activitiesById[acti].filledTasks.push({f_date: tmp, f_duration: ''});
            }
            for (var i = 0; i < activitiesById[acti].tasks.length; i++) {
                var origiTask = activitiesById[acti].tasks[i];
                for (var j = 0; j < activitiesById[acti].filledTasks.length; j++) {
                    var filledTask = activitiesById[acti].filledTasks[j];
                    if (origiTask.f_date.getDate() == filledTask.f_date.getDate()) {
                        var duration = origiTask.f_duration.replace(/,/, '.');
                        workedDays += parseFloat(duration);
                        activitiesById[acti].rowTotal += parseFloat(duration);
                        activitiesById[acti].filledTasks[j].f_duration = origiTask.f_duration;
                    }
                }
            }
            activitiesById[acti].tasks = undefined;
            activities.push(activitiesById[acti]);
        }

        var dustSrc = fs.readFileSync(__dirname+'/../views/e_cra/export_template.dust', 'utf8');
        models.E_cra_team.findOne({
            include: [{
                model: models.E_user,
                as: 'r_user',
                where: {id: user.id}
            }]
        }).then(function(team) {
            var options = {
                file: __dirname + '/../views/e_cra/export_template.docx',
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                data: {
                    activities: activities,
                    daysAndLabels: daysAndLabels,
                    workedDays: workedDays,
                    cra: cra,
                    user: user,
                    team: team
                },
                lang: req.session.lang_user
            };
            generateDocxDoc(options).then(function(infos) {
                var filename = moment().format('DDMMYYYY_HHmmss') +
                    '_' + moment().unix() +
                    infos.ext;
                res.writeHead(200, {
                    "Content-Type": infos.contentType,
                    "Content-Disposition": "attachment;filename=" + filename
                });
                res.write(infos.buffer);
                res.end();
            }).catch(function(e) {
                console.log(e);
                req.session.toastr = [{
                    message: e.message,
                    level: "error"
                }];
                res.redirect(req.headers.referer);
            });
        });
    });
});

router.get('/show', block_access.actionAccessMiddleware("cra", "read"), function (req, res) {
    var id_e_cra = req.query.id;
    var tab = req.query.tab;
    var data = {
        menu: "e_cra",
        sub_menu: "list_e_cra",
        tab: tab,
        enum_radio: enums_radios.translated("e_cra", req.session.lang_user, options)
    };

    /* If we arrive from an associated tab, hide the create and the list button */
    if (typeof req.query.hideButton !== 'undefined') {
        data.hideButton = req.query.hideButton;
    }

    /* Looking for two level of include to get all associated data in show tab list */
    var include = model_builder.getTwoLevelIncludeAll(models, options);

    models.E_cra.findOne({where: {id: id_e_cra}, include: include}).then(function (e_cra) {
        if (!e_cra) {
            data.error = 404;
            logger.debug("No data entity found.");
            return res.render('common/error', data);
        }

        /* Modify e_cra value with the translated enum value in show result */
        for (var item in data.enum) {
            for (var field in e_cra.dataValues) {
                if (item == field) {
                    for (var value in data.enum[item]) {
                        if (data.enum[item][value].value == e_cra[field]) {
                            e_cra[field] = data.enum[item][value].translation;
                        }
                    }
                }
            }
        }
        /* Update local e_cra data before show */
        data.e_cra = e_cra;
        res.render('e_cra/show', data);

    }).catch(function (err) {
        entity_helper.error(err, req, res, "/");
    });
});

router.get('/create_form', block_access.actionAccessMiddleware("cra", "create"), function (req, res) {
    var data = {
        menu: "e_cra",
        sub_menu: "create_e_cra",
        enum_radio: enums_radios.translated("e_cra", req.session.lang_user, options)
    };

    if (typeof req.query.associationFlag !== 'undefined') {
        data.associationFlag = req.query.associationFlag;
        data.associationSource = req.query.associationSource;
        data.associationForeignKey = req.query.associationForeignKey;
        data.associationAlias = req.query.associationAlias;
        data.associationUrl = req.query.associationUrl;
    }

    res.render('e_cra/create', data);
});

router.post('/create', block_access.actionAccessMiddleware("cra", "create"), function (req, res) {

    var createObject = model_builder.buildForRoute(attributes, options, req.body);
    //createObject = enums.values("e_cra", createObject, req.body);

    models.E_cra.create(createObject).then(function (e_cra) {
        var redirect = '/cra/list';
        req.session.toastr = [{
                message: 'message.create.success',
                level: "success"
            }];

        if (typeof req.body.associationFlag !== 'undefined') {
            redirect = '/' + req.body.associationUrl + '/show?id=' + req.body.associationFlag + '#' + req.body.associationAlias;
            models[entity_helper.capitalizeFirstLetter(req.body.associationSource)].findOne({where: {id: req.body.associationFlag}}).then(function (association) {
                if (!association) {
                    e_cra.destroy();
                    var err = new Error();
                    err.message = "Association not found."
                    return entity_helper.error(err, req, res, "/");
                }

                var modelName = req.body.associationAlias.charAt(0).toUpperCase() + req.body.associationAlias.slice(1).toLowerCase();
                if (typeof association['add' + modelName] !== 'undefined')
                    association['add' + modelName](e_cra.id);
                else {
                    var obj = {};
                    obj[req.body.associationForeignKey] = e_cra.id;
                    association.update(obj);
                }
            });
        }

        // We have to find value in req.body that are linked to an hasMany or belongsToMany association
        // because those values are not updated for now
        model_builder.setAssocationManyValues(e_cra, req.body, createObject, options);

        res.redirect(redirect);
    }).catch(function (err) {
        entity_helper.error(err, req, res, '/cra/create_form');
    });
});

router.get('/update_form', block_access.actionAccessMiddleware("cra", 'update'), function (req, res) {
    id_e_cra = req.query.id;
    var data = {
        menu: "e_cra",
        sub_menu: "list_e_cra",
        enum_radio: enums_radios.translated("e_cra", req.session.lang_user, options)
    };

    if (typeof req.query.associationFlag !== 'undefined') {
        data.associationFlag = req.query.associationFlag;
        data.associationSource = req.query.associationSource;
        data.associationForeignKey = req.query.associationForeignKey;
        data.associationAlias = req.query.associationAlias;
        data.associationUrl = req.query.associationUrl;
    }

    models.E_cra.findOne({where: {id: id_e_cra}, include: [{all: true}]}).then(function (e_cra) {
        if (!e_cra) {
            data.error = 404;
            return res.render('common/error', data);
        }

        data.e_cra = e_cra;
        res.render('e_cra/update', data);
    }).catch(function (err) {
        entity_helper.error(err, req, res, "/");
    });
});

router.post('/update', block_access.actionAccessMiddleware("cra", 'update'), function (req, res) {
    var id_e_cra = parseInt(req.body.id);

    if (typeof req.body.version !== "undefined" && req.body.version != null && !isNaN(req.body.version) && req.body.version != '')
        req.body.version = parseInt(req.body.version) + 1;
    else
        req.body.version = 0;

    var updateObject = model_builder.buildForRoute(attributes, options, req.body);
    //updateObject = enums.values("e_cra", updateObject, req.body);

    models.E_cra.findOne({where: {id: id_e_cra}}).then(function (e_cra) {
        if (!e_cra) {
            data.error = 404;
            logger.debug("Not found - Update");
            return res.render('common/error', data);
        }

        e_cra.update(updateObject, {where: {id: id_e_cra}}).then(function () {

            // We have to find value in req.body that are linked to an hasMany or belongsToMany association
            // because those values are not updated for now
            model_builder.setAssocationManyValues(e_cra, req.body, updateObject, options);

            var redirect = '/cra/show?id=' + id_e_cra;
            if (typeof req.body.associationFlag !== 'undefined')
                redirect = '/' + req.body.associationUrl + '/show?id=' + req.body.associationFlag + '#' + req.body.associationAlias;

            req.session.toastr = [{
                message: 'message.update.success',
                level: "success"
            }];

            res.redirect(redirect);
        }).catch(function (err) {
            entity_helper.error(err, req, res, '/cra/update_form?id=' + id_e_cra);
        });
    }).catch(function (err) {
        entity_helper.error(err, req, res, '/cra/update_form?id=' + id_e_cra);
    });
});

router.post('/delete', block_access.actionAccessMiddleware("cra", "delete"), function (req, res) {
    var id_e_cra = req.body.id;

    models.E_cra.destroy({
        where: {
            id: id_e_cra
        }
    }).then(function () {
        req.session.toastr = [{
                message: 'message.delete.success',
                level: "success"
            }];
        var redirect = '/cra/list';
        if (typeof req.body.associationFlag !== 'undefined')
            redirect = '/' + req.body.associationUrl + '/show?id=' + req.body.associationFlag + '#' + req.body.associationAlias;
        res.redirect(redirect);
    }).catch(function (err) {
        entity_helper.error(err, req, res, '/cra/list');
    });
});

module.exports = router;
