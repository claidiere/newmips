// Newmips Database
const db_project = require("../database/project");
const db_application = require("../database/application");
const db_module = require("../database/module");
const db_entity = require("../database/data_entity");
const db_field = require("../database/data_field");
const db_component = require("../database/component");
const database = require("../database/database");

// Session
const session = require("./session");

// Bot grammar
let bot = require('../services/bot.js');

// Structure files
let structure_application = require("../structure/structure_application");
let structure_module = require("../structure/structure_module");
let structure_data_entity = require("../structure/structure_data_entity");
let structure_data_field = require("../structure/structure_data_field");
let structure_component = require("../structure/structure_component");
let structure_ui = require("../structure/structure_ui");

// Utils
let helpers = require("../utils/helpers");
let attrHelper = require("../utils/attr_helper");
let gitHelper = require("../utils/git_helper");
let translateHelper = require("../utils/translate");

// Others
const fs = require('fs-extra');
const sequelize = require('../models/').sequelize;
const cloud_manager = require('../services/cloud_manager');

/* --------------------------------------------------------------- */
/* -------------------------- General ---------------------------- */
/* --------------------------------------------------------------- */

// Execute an array of newmips instructions
exports.recursiveInstructionExecute = function (sessionAttr, instructions, idx, callback) {
    var exportsContext = this;
    // Create the attr obj
    var recursiveAttr = bot.parse(instructions[idx]);
    if (recursiveAttr.error) {
        console.error(recursiveAttr.error);
        return callback(recursiveAttr.error);
    }

    // Rework the attr obj
    recursiveAttr = attrHelper.reworkAttr(recursiveAttr);

    // Add current session info in attr object
    recursiveAttr.id_project = sessionAttr.id_project;
    recursiveAttr.id_application = sessionAttr.id_application;
    recursiveAttr.id_module = sessionAttr.id_module;
    recursiveAttr.id_data_entity = sessionAttr.id_data_entity;

    // Execute the designer function
    this[recursiveAttr.function](recursiveAttr, function (err, info) {
        if (err)
            return callback(err, info);

        session.setSessionInAttr(recursiveAttr, info);
        idx += 1;
        if (instructions.length == idx)
            return callback(err, info);
        exportsContext.recursiveInstructionExecute(recursiveAttr, instructions, idx, callback);
    });
}

exports.help = function (attr, callback) {
    session.help(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

exports.showSession = function (attr, callback) {
    session.showSession(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

exports.deploy = function (attr, callback) {
    db_application.getCodeNameApplicationById(attr.id_application, (err, codeName) => {
        if (err)
            return callback(err, null);

        attr.appCodeName = codeName;
        cloud_manager.deploy(attr, (err, info) => {
            if (err)
                return callback(err, null);
            callback(null, info);
        });
    });
}

exports.restart = function (attr, callback) {
    var info = {
        message: "structure.global.restart.success"
    };
    callback(null, info);
}

exports.installNodePackage = function (attr, callback) {
    structure_application.installAppModules(attr).then(function () {
        var info = {
            message: "structure.global.npmInstall.success"
        };
        callback(null, info);
    });
}

/* --------------------------------------------------------------- */
/* --------------------------- Git ------------------------------- */
/* --------------------------------------------------------------- */

exports.gitPush = function (attr, callback) {
    gitHelper.gitPush(attr, function (err, infoGit) {
        if (err)
            return callback(err, null);
        var info = {};
        info.message = "structure.global.gitPush.success";
        callback(null, info);
    });
}

exports.gitPull = function (attr, callback) {
    gitHelper.gitPull(attr, function (err, infoGit) {
        if (err)
            return callback(err, null);
        var info = {};
        info.message = "structure.global.gitPull.success";
        callback(null, info);
    });
}

exports.gitCommit = function (attr, callback) {
    gitHelper.gitCommit(attr, function (err, infoGit) {
        if (err)
            return callback(err, null);
        var info = {};
        info.message = "structure.global.gitCommit.success";
        callback(null, info);
    });
}

exports.gitStatus = function (attr, callback) {
    gitHelper.gitStatus(attr, function (err, infoGit) {
        if (err)
            return callback(err, null);
        var info = {};
        info.message = JSON.stringify(infoGit);
        info.message = info.message.replace(/,/g, ",<br>");
        callback(null, info);
    });
}

/* --------------------------------------------------------------- */
/* ------------------------- Project ----------------------------- */
/* --------------------------------------------------------------- */
exports.selectProject = function (attr, callback) {
    db_project.selectProject(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

exports.createNewProject = function (attr, callback) {
    db_project.createNewProject(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

exports.listProject = function (attr, callback) {
    db_project.listProject(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

exports.deleteProject = function (attr, callback) {
    db_project.checkAccessAllApplication(attr).then(hasAcess => {
        if(!hasAcess){
            let err = new Error("You do not have access to all the applications in this project, you cannot delete it.")
            return callback(err, null);
        }
        db_project.getProjectApplications(attr.options.showValue, function (err, applications) {
            if (err)
                return callback(err, null);

            var appIds = [];
            for (var i = 0; i < applications.length; i++)
                appIds.push(applications[i].id);

            deleteApplicationRecursive(appIds, attr.currentUser, 0).then(function () {
                db_project.deleteProject(attr.options.showValue, function (err, info) {
                    if (err)
                        return callback(err, null);

                    callback(null, info);
                });
            }).catch(function (err) {
                callback(err, null);
            })
        })
    })
}

/* --------------------------------------------------------------- */
/* ----------------------- Application --------------------------- */
/* --------------------------------------------------------------- */
exports.selectApplication = function (attr, callback) {
    var exportsContext = this;
    db_application.selectApplication(attr, function (err, info) {
        if (err) {
            callback(err, null);
        } else {
            var instructions = [
                "select module home"
            ];

            attr.id_application = info.insertId;

            // Select the module home automatically after selecting an application
            exportsContext.recursiveInstructionExecute(attr, instructions, 0, function (err) {
                if (err)
                    return callback(err, null);
                info.name_application = attr.options.value;
                callback(null, info);
            });
        }
    });
}

exports.createNewApplication = function (attr, callback) {
    // Check if an application with this name alreadyExist or no
    db_application.exist(attr, function (err, exist) {
        if (err)
            return callback(err);

        if (exist) {
            var error = new Error("database.application.alreadyExist");
            error.messageParams = [attr.options.showValue];
            return callback(error);
        }

        db_application.createNewApplication(attr, function (err, info) {
            if (err)
                return callback(err);

            // Structure application
            attr.id_application = info.insertId;
            info.name_application = attr.options.urlValue;
            structure_application.setupApplication(attr, err => {
                if(err)
                    return callback(err)
                callback(null, info);
            });
        });
    });
}

exports.listApplication = function (attr, callback) {
    db_application.listApplication(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

// Declare this function not directly within exports to be able to use it from deleteApplicationRecursive()
function deleteApplication(attr, callback) {
    function doDelete(id_application) {
        db_application.checkAccess(attr).then(hasAccess => {
            if(!hasAccess){
                let err = new Error("You do not have access to this application, you cannot delete it.")
                return callback(err, null);
            }

            structure_application.deleteApplication(id_application, function (err, infoStructure) {
                if (err)
                    return callback(err, null);

                var request = "";
                if(sequelize.options.dialect == "mysql")
                    request = "SHOW TABLES LIKE '" + id_application + "_%';";
                else if(sequelize.options.dialect == "postgres")
                    request = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema' AND tablename LIKE '" + id_application + "_%'";

                sequelize.query(request).spread(function (results, metada) {
                    db_application.deleteApplication(id_application, function (err, infoDB) {
                        if (err)
                            return callback(err, null);
                        /* Calculate the length of table to drop */
                        var resultLength = 0;

                        for (var i = 0; i < results.length; i++) {
                            for (var prop in results[i]) {
                                resultLength++;
                            }
                        }

                        /* Function when all query are done */
                        var request = "";
                        if(sequelize.options.dialect == "mysql")
                            request += "SET FOREIGN_KEY_CHECKS=0;";

                        for (var i = 0; i < results.length; i++) {
                            for (var prop in results[i]) {
                                // Postgres additionnal check
                                if(typeof results[i][prop] == "string" && results[i][prop].indexOf(id_application + "_") != -1){
                                    // For each request disable foreign key checks, drop table. Foreign key check
                                    // last only for the time of the request
                                    if(sequelize.options.dialect == "mysql")
                                        request += "DROP TABLE " + results[i][prop] + ";";
                                    if(sequelize.options.dialect == "postgres")
                                        request += "DROP TABLE \"" + results[i][prop] + "\" CASCADE;";
                                }
                            }
                        }

                        if(sequelize.options.dialect == "mysql")
                            request += "SET FOREIGN_KEY_CHECKS=1;";

                        sequelize.query(request).then(function () {
                            callback(null, infoDB);
                        }).catch(function(err){
                            console.error("ERROR ERR: "+err.message);
                            console.error("ERROR SQL: "+err.original.sql);
                            callback(null, infoDB);
                        })
                    })
                })
            })
        })
    }
    if (isNaN(attr.options.showValue))
        db_application.getIdApplicationByCodeName(attr.options.value, attr.options.showValue, function (err, id_application) {
            if (err)
                return callback(err, null);
            doDelete(id_application);
        })
    else {
        doDelete(attr.options.showValue);
    }
}
exports.deleteApplication = deleteApplication;

function deleteApplicationRecursive(appIds, currentUser, idx) {
    return new Promise(function (resolve, reject) {
        if (!appIds[idx])
            return resolve();

        var attr = {
            options: {
                value: appIds[idx],
                showValue: appIds[idx]
            },
            currentUser: currentUser
        };

        deleteApplication(attr, function (err, info) {
            if (err)
                return reject(err);
            return (appIds[++idx]) ? resolve(deleteApplicationRecursive(appIds, idx)) : resolve();
        });
    });
}

/* --------------------------------------------------------------- */
/* ------------------------- Module ------------------------------ */
/* --------------------------------------------------------------- */
exports.selectModule = function (attr, callback) {
    db_module.selectModule(attr, function (err, infoDB) {
        if (err)
            return callback(err, null);
        callback(null, infoDB);
    });
}

exports.createNewModule = function (attr, callback) {
    db_module.createNewModule(attr, function (err, infoDB) {
        if (err)
            return callback(err, null);
        infoDB.moduleName = attr.options.urlValue;
        // Retrieve list of application modules to update them all
        db_module.listModuleByApplication(attr, function (err, modules) {
            if (err)
                return callback(err, null);

            // Assign list of existing application modules
            // Needed to recreate the dropdown list of modules in the interface
            attr.modules = modules;

            // Structure
            structure_module.setupModule(attr, function (err, data) {
                callback(null, infoDB);
            });
        });
    });
}

exports.listModule = function (attr, callback) {
    db_module.listModule(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

exports.deleteModule = function (attr, callback) {
    var moduleName = attr.options.showValue;
    if (moduleName.toLowerCase() == 'home') {
        var err = new Error("structure.module.error.notHome");
        return callback(err, null);
    }

    db_module.getEntityListByModuleName(attr.id_application, moduleName, function (err, entities) {
        if (err)
            return callback(err, null);
        var promises = [];
        for (var i = 0; i < entities.length; i++) {
            var tmpAttr = {
                id_application: attr.id_application,
                id_module: attr.id_module,
                id_project: attr.id_project,
                options: {
                    value: entities[i].codeName,
                    showValue: entities[i].name
                }
            }

            promises.push(new Promise(function (resolve, reject) {
                (function (tmpAttrIn) {
                    deleteDataEntity(tmpAttrIn, function (err) {
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    })
                })(tmpAttr);
            }));
        }

        Promise.all(promises).then(function () {
            attr.module_name = attr.options.value;
            structure_module.deleteModule(attr, function (err) {
                if (err)
                    return callback(err, null);
                db_module.deleteModule(attr.id_application, attr.module_name, moduleName, function (err, info) {
                    if (err)
                        return callback(err, null);

                    db_module.getHomeModuleId(attr.id_application, function (err, homeID) {
                        info.homeID = homeID;
                        callback(null, info);
                    });
                });
            });
        }).catch(function (err) {
            callback(err, null);
        });
    });
}

/* --------------------------------------------------------------- */
/* --------------------------- Entity ---------------------------- */
/* --------------------------------------------------------------- */
exports.selectEntity = function (attr, callback) {
    db_entity.selectEntity(attr, function (err, info) {
        if (err)
            return callback(err, null);
        db_module.getModuleById(info.moduleId, function (err, module) {
            if (err)
                return callback(err, null);
            structure_data_field.selectEntity(attr.id_application, module.codeName, info.urlEntity, function (err, doRedirect) {
                if (err)
                    return callback(err, null);
                info.doRedirect = doRedirect;
                callback(null, info);
            });
        });
    });
}

exports.createNewEntity = function (attr, callback) {

    // Get active application module name
    db_module.getModuleById(attr.id_module, function (err, module) {
        if (err)
            return callback(err, null);

        attr.show_name_module = module.name;
        attr.name_module = module.codeName;
        // Generator database
        db_entity.createNewEntity(attr, function (err, infoDB) {
            if (err)
                return callback(err, null);
            structure_data_entity.setupDataEntity(attr, function (err, data) {
                callback(null, infoDB);
            });
        });
    });
}

exports.listDataEntity = function (attr, callback) {
    db_entity.listDataEntity(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

function deleteDataEntity(attr, callback) {

    function checkIfIDGiven(attr, callback) {
        // If it was the ID instead of the name given in the instruction
        if (!isNaN(attr.options.showValue)) {
            db_entity.getDataEntityById(attr.options.showValue, function (err, entity) {
                if (err)
                    return callback(err, null);

                attr.options.value = entity.codeName;
                attr.options.showValue = entity.name;
                attr.options.urlValue = entity.codeName.substring(2);
                callback(null, attr);
            });
        } else {
            callback(null, attr);
        }
    }

    checkIfIDGiven(attr, function (err, attr) {
        if (err)
            return callback(err, null);

        var id_application = attr.id_application;
        var name_data_entity = attr.options.value.toLowerCase();
        var show_name_data_entity = attr.options.showValue.toLowerCase();

        var name_module = "";

        var promises = [];
        var workspacePath = __dirname + '/../workspace/' + id_application;

        db_entity.getIdDataEntityByCodeName(attr.id_module, name_data_entity, function (err, entityId) {
            if (err)
                return callback(err, null);

            // Delete entity relations
            var entityOptions = JSON.parse(fs.readFileSync(workspacePath + '/models/options/' + name_data_entity + '.json'));
            for (var i = 0; i < entityOptions.length; i++) {
                if (entityOptions[i].relation == 'hasMany') {
                    var tmpAttr = {
                        options: {
                            value: entityOptions[i].as,
                            urlValue: entityOptions[i].as.substring(2)
                        },
                        id_project: attr.id_project,
                        id_application: attr.id_application,
                        id_module: attr.id_module,
                        id_data_entity: entityId,
                        structureType: entityOptions[i].structureType
                    };
                    promises.push({func: function (tmpAttrIn, clbk) {
                        if (tmpAttrIn.structureType == "hasMany" || tmpAttrIn.structureType == "hasManyPreset") {
                            if(tmpAttrIn.options && tmpAttrIn.options.value != '' && tmpAttrIn.options.value.indexOf('r_history_') != -1){
                                let statusName = tmpAttrIn.options.value.split('r_history_')[1];
                                deleteComponentStatus({
                                    id_application: tmpAttrIn.id_application,
                                    id_data_entity: tmpAttrIn.id_data_entity,
                                    options: {
                                        value : "s_"+statusName,
                                        urlValue: statusName,
                                        showValue: statusName
                                    }
                                }, err => {
                                    if (err)
                                        console.error(err);
                                    clbk();
                                });
                            } else {
                                deleteTab(tmpAttrIn, err => {
                                    if (err)
                                        console.error(err);
                                    clbk();
                                });
                            }
                        } else if (tmpAttrIn.structureType == "relatedToMultiple" || tmpAttrIn.structureType == "relatedToMultipleCheckbox") {
                            tmpAttrIn.options.value = "f_" + tmpAttrIn.options.value.substring(2);
                            deleteDataField(tmpAttrIn, function (err) {
                                if (err)
                                    console.error(err);
                                clbk();
                            });
                        } else {
                            console.warn("WARNING - Unknown option to delete !");
                            console.warn(tmpAttrIn);
                            clbk();
                        }
                    }, arg: tmpAttr});
                }
                else if (entityOptions[i].relation == 'belongsToMany') {
                    promises.push({
                        func: function(tableName, clbk) {
                            database.dropTable(tableName, function(err) {
                                if (err)
                                    console.error("Unable to delete junction table "+tableName);
                                clbk();
                            })
                        },
                        arg: entityOptions[i].through
                    })
                }
            }

            // Delete relation comming from other entities
            fs.readdirSync(workspacePath + '/models/options/').filter(function (file) {
                return file.indexOf('.') !== 0 && file.slice(-5) === '.json' && file.slice(0, -5) != name_data_entity;
            }).forEach(function (file) {
                let source = file.slice(0, -5);
                let options = JSON.parse(fs.readFileSync(workspacePath + '/models/options/' + file));

                // Look for auto_generate key targeting deleted entity and remove them
                let idxToRemove = [];
                for (let i = 0; i < options.length; i++) {
                    if (options[i].target != name_data_entity)
                        continue;
                    if (options[i].structureType == 'auto_generate')
                        idxToRemove.push(i);
                }
                options = options.filter((val, idx, arr) => {
                    return idxToRemove.indexOf(idx) == -1
                })
                fs.writeFileSync(workspacePath + '/models/options/' + file, JSON.stringify(options, null, 4), 'utf8')

                for (let i = 0; i < options.length; i++) {
                    if (options[i].target != name_data_entity)
                        continue;

                    if (options[i].relation == 'hasMany') {
                        let tmpAttr = {
                            options: {
                                value: options[i].as,
                                urlValue: options[i].as.substring(2)
                            },
                            id_project: attr.id_project,
                            id_application: attr.id_application,
                            id_module: attr.id_module,
                            structureType: options[i].structureType
                        };

                        promises.push({
                            func: function(tmpAttrIn, clbk) {
                                db_entity.getIdDataEntityByCodeName(attr.id_module, source, function(err, sourceID) {
                                    tmpAttrIn.id_data_entity = sourceID;
                                    if (tmpAttrIn.structureType == "hasMany" || tmpAttrIn.structureType == "hasManyPreset") {
                                        deleteTab(tmpAttrIn, function(err) {
                                            if (err)
                                                console.error(err);
                                            clbk();
                                        });
                                    } else if (tmpAttrIn.structureType == "relatedToMultiple" || tmpAttrIn.structureType == "relatedToMultipleCheck") {
                                        tmpAttrIn.options.value = "f_" + tmpAttrIn.options.value.substring(2);
                                        deleteDataField(tmpAttrIn, function(err) {
                                            if (err)
                                                console.error(err);
                                            clbk();
                                        });
                                    } else {
                                        console.warn("WARNING - Unknown option to delete !");
                                        console.warn(tmpAttrIn);
                                        clbk();
                                    }
                                });
                            },
                            arg: tmpAttr
                        });
                    }
                    else if (options[i].relation == 'belongsTo') {
                        let tmpAttr = {
                            options: {
                                value: options[i].as,
                                urlValue: options[i].as.substring(2)
                            },
                            id_project: attr.id_project,
                            id_application: attr.id_application,
                            id_module: attr.id_module,
                            structureType: options[i].structureType
                        };

                        promises.push({
                            func: function(tmpAttrIn, clbk) {
                                db_entity.getIdDataEntityByCodeName(attr.id_module, source, function(err, sourceID) {
                                    tmpAttrIn.id_data_entity = sourceID;
                                    if (tmpAttrIn.structureType == "relatedTo") {
                                        tmpAttrIn.options.value = "f_" + tmpAttrIn.options.value.substring(2);
                                        deleteDataField(tmpAttrIn, function(err) {
                                            if (err)
                                                console.error(err);
                                            clbk();
                                        });
                                    } else if (tmpAttrIn.structureType == "hasOne") {
                                        deleteTab(tmpAttrIn, function(err) {
                                            if (err)
                                                console.error(err);
                                            clbk();
                                        });
                                    } else {
                                        console.warn("WARNING - Unknown option to delete !");
                                        console.warn(tmpAttrIn);
                                        clbk();
                                    }
                                });
                            },
                            arg: tmpAttr
                        });
                    }
                }
            });

            attr.entityTarget = attr.options.showValue;
            deleteEntityWidgets(attr, function (err) {
                if (err)
                    return callback(err);

                function orderedTasks(tasks, idx, overClbk) {
                    if (!tasks[idx])
                        return overClbk();
                    tasks[idx].func(tasks[idx].arg, function () {
                        orderedTasks(tasks, idx + 1, overClbk);
                    });
                }
                orderedTasks(promises, 0, function () {
                    db_entity.getModuleCodeNameByEntityCodeName(name_data_entity, attr.id_module, function (err, name_module) {
                        if (err)
                            return callback(err, null);
                        database.dropDataEntity(id_application, name_data_entity, function (err) {
                            if (err)
                                return callback(err);
                            attr.name_data_entity = name_data_entity;
                            attr.show_name_data_entity = show_name_data_entity;
                            db_entity.deleteDataEntity(attr, function (err, infoDB) {
                                if (err)
                                    return callback(err);
                                var url_name_data_entity = attr.options.urlValue;
                                structure_data_entity.deleteDataEntity(id_application, name_module, name_data_entity, url_name_data_entity, function () {
                                    infoDB.deletedEntityId = entityId;
                                    callback(null, infoDB);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}
exports.deleteDataEntity = deleteDataEntity;

/* --------------------------------------------------------------- */
/* --------------------------- Field ----------------------------- */
/* --------------------------------------------------------------- */
exports.createNewDataField = function (attr, callback) {
    // Get active data entity name
    db_entity.getDataEntityById(attr.id_data_entity, function (err, data_entity) {
        if (err)
            return callback(err, null);

        // Get active application module name
        db_module.getNameModuleById(attr.id_module, function (err, name_module) {
            if (err)
                return callback(err, null);

            attr.name_module = name_module;
            db_field.createNewDataField(attr, function (err, info) {
                if (err)
                    return callback(err, null);

                attr.name_data_entity = data_entity.name;
                attr.codeName_data_entity = data_entity.codeName;
                structure_data_field.setupDataField(attr, function (err, data) {
                    if (err)
                        db_field.deleteDataField(attr, function (error, info) {
                            callback(err, null);
                        });
                    else
                        callback(null, info);
                });
            });
        });
    });
}

function deleteTab(attr, callback) {
    var infoDesigner = {};
    db_entity.getDataEntityById(attr.id_data_entity, function (err, dataEntity) {
        if (err) {
            return callback(err, infoDesigner);
        }

        attr.name_data_entity = dataEntity.codeName;
        attr.show_name_data_entity = dataEntity.name;

        structure_data_field.deleteTab(attr, function (err, fk, target, tabType) {
            if (err) {
                return callback(err, infoDesigner);
            }
            infoDesigner.tabType = tabType;

            attr.fieldToDrop = fk;
            attr.name_data_entity = target;
            database.dropFKDataField(attr, function (err, infoDatabase) {
                if (err) {
                    return callback(err, infoDesigner);
                }

                // Missing id_ in attr.options.value, so we use fieldToDrop
                attr.options.value = attr.fieldToDrop;
                db_field.deleteDataField(attr, function (err, infoDB) {
                    if (err) {
                        return callback(err, infoDesigner);
                    }

                    infoDesigner.message = "structure.association.deleteTab";
                    infoDesigner.messageParams = [attr.options.showValue];

                    callback(null, infoDesigner);
                });
            });
        });
    });
}
exports.deleteTab = deleteTab;

// Delete
function deleteDataField(attr, callback) {
    // Get Entity or Type Id
    db_entity.getDataEntityById(attr.id_data_entity, function (err, dataEntity) {
        if (err)
            return callback(err, null);

        // Set name of data entity in attributes
        attr.name_data_entity = dataEntity.codeName;
        attr.show_name_data_entity = dataEntity.name;

        // Get field name
        var options = attr.options;
        var name_data_field = options.value;

        try {
            function checkIfIDGiven(attr, callback2) {
                // If it was the ID instead of the name given in the instruction
                if (!isNaN(attr.options.showValue)) {
                    db_field.getNameDataFieldById(parseInt(attr.options.showValue), function (err, field) {
                        if (err)
                            return callback2(err, null);

                        attr.options.value = field.codeName;
                        attr.options.showValue = field.name;
                        callback2(null, attr);
                    });
                } else
                    callback2(null, attr);
            }

            checkIfIDGiven(attr, function (err, attr) {
                if (err)
                    return callback(err);
                // Delete field from views and models
                structure_data_field.deleteDataField(attr, function (err, infoStructure) {
                    if (err)
                        return callback(err, null);

                    // Alter database
                    attr.fieldToDrop = infoStructure.fieldToDrop;
                    var dropFunction = infoStructure.isConstraint ? 'dropFKDataField' : 'dropDataField';

                    // Related To Multiple
                    if (infoStructure.isMultipleConstraint) {
                        attr.target = infoStructure.target;
                        dropFunction = 'dropFKMultipleDataField';
                    }

                    var checkFieldParams = {
                        codeName: attr.fieldToDrop,
                        showValue: attr.options.showValue,
                        idEntity: attr.id_data_entity,
                        showEntity: attr.show_name_data_entity
                    };
                    // Check if field exist
                    db_field.getFieldByCodeName(checkFieldParams, function (err, fieldExist) {
                        if (err)
                            return callback(err, null);

                        database[dropFunction](attr, function (err, info) {
                            if (err)
                                return callback(err, null);

                            // Missing id_ in attr.options.value, so we use fieldToDrop
                            attr.options.value = attr.fieldToDrop;
                            // Delete record from software
                            db_field.deleteDataField(attr, function (err, infoDB) {
                                if (err)
                                    return callback(err, null);

                                callback(null, infoDB);
                            });
                        });
                    });

                });
            });
        } catch (err) {
            callback(err, null);
        }
    });
}
exports.deleteDataField = deleteDataField;

exports.listDataField = function (attr, callback) {
    db_field.listDataField(attr, function (err, info) {
        if (err)
            return callback(err, null);
        callback(null, info);
    });
}

/* --------------------------------------------------------------- */
/* ---------------------- Field Attributes ----------------------- */
/* --------------------------------------------------------------- */

exports.setFieldKnownAttribute = function (attr, callback) {
    db_entity.getDataEntityById(attr.id_data_entity, function (err, dataEntity) {
        if (err)
            return callback(err, null);

        attr.name_data_entity = dataEntity.codeName;

        var wordParam = attr.options.word.toLowerCase();
        var requiredAttribute = ["mandatory", "required", "obligatoire", "optionnel", "non-obligatoire", "optional"];
        var uniqueAttribute = ["unique", "not-unique", "non-unique"];

        var checkFieldParams = {
            codeName: attr.options.value,
            showValue: attr.options.showValue,
            idEntity: attr.id_data_entity,
            showEntity: dataEntity.name
        };
        db_field.getFieldByCodeName(checkFieldParams, function (err, fieldExist) {
            if (err) {
                // Not found as a simple field, look for related to field
                var optionsArray = JSON.parse(helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + dataEntity.codeName + '.json'));
                var found = false;
                for (var i = 0; i < optionsArray.length; i++) {
                    if (optionsArray[i].showAs == attr.options.showValue) {
                        if (optionsArray[i].structureType == "relatedTo") {
                            // We need the key in DB to set it unique instead of the client side name of the field
                            if (uniqueAttribute.indexOf(wordParam) != -1) {
                                attr.options.value = optionsArray[i].foreignKey;
                            }
                            found = true;
                        } else if (optionsArray[i].structureType == "relatedToMultiple" || optionsArray[i].structureType == "relatedToMultipleCheckbox") {
                            if (uniqueAttribute.indexOf(wordParam) != -1) {
                                var err = new Error("structure.field.attributes.notUnique4RelatedToMany");
                                return callback(err, null);
                            } else {
                                attr.structureType = optionsArray[i].structureType;
                                found = true;
                            }
                        }
                        break;
                    }
                }
                if (!found)
                    return callback(err, null);
            }

            // Check the attribute asked in the instruction
            if (requiredAttribute.indexOf(wordParam) != -1) {
                // Get DB SQL type needed to Alter Column
                db_field.getDatabaseSQLType({
                    table: attr.id_application+"_"+attr.name_data_entity.toLowerCase(),
                    column: attr.options.value
                }, function(sqlDataType, sqlDataTypeLength){
                    attr.sqlDataType = sqlDataType;
                    attr.sqlDataTypeLength = sqlDataTypeLength;
                    attr.dialect = sequelize.options.dialect;
                    structure_data_field.setRequiredAttribute(attr, function (err) {
                        if (err)
                            return callback(err, null);

                        callback(null, {
                            message: "structure.field.attributes.successKnownAttribute",
                            messageParams: [attr.options.showValue, attr.options.word]
                        })
                    })
                })
            } else if (uniqueAttribute.indexOf(wordParam) != -1) {

                let sourceEntity = attr.id_application + "_" + attr.name_data_entity;
                let constraintName = sourceEntity + "_" + attr.options.value + "_unique";

                let possibilityUnique = ["unique"];
                let possibilityNotUnique = ["not-unique", "non-unique"];

                let attribute = attr.options.word.toLowerCase();
                let request = "";

                // Get application database, it won't be newmips if seperate DB
                let appDBConf = require(__dirname+'/../workspace/' + attr.id_application + '/config/database.js');

                // Add or remove the unique constraint ?
                if(sequelize.options.dialect == "mysql"){
                    if (possibilityUnique.indexOf(attribute) != -1) {
                        request = "ALTER TABLE `" + appDBConf.database + "`.`" + sourceEntity + "` ADD CONSTRAINT " + constraintName + " UNIQUE (`" + attr.options.value + "`);";
                    } else if (possibilityNotUnique.indexOf(attribute) != -1) {
                        request = "ALTER TABLE `" + appDBConf.database + "`.`" + sourceEntity + "` DROP INDEX `" + constraintName + "`;";
                    }
                } else if (sequelize.options.dialect == "postgres"){
                    if (possibilityUnique.indexOf(attribute) != -1) {
                        request = "ALTER TABLE \"" + appDBConf.database + "\".\"" + sourceEntity + "\" ADD CONSTRAINT \"" + constraintName + "\" UNIQUE (" + attr.options.value + ");";
                    } else if (possibilityNotUnique.indexOf(attribute) != -1) {
                        request = "ALTER TABLE \"" + appDBConf.database + "\".\"" + sourceEntity + "\" DROP INDEX \"" + constraintName + "\";";
                    }
                }

                sequelize.query(request).then(function () {
                    structure_data_field.setUniqueField(attr, function (err) {
                        if (err)
                            return callback(err, null);

                        callback(null, {
                            message: "structure.field.attributes.successKnownAttribute",
                            messageParams: [attr.options.showValue, attr.options.word]
                        });
                    });
                }).catch(function (err) {
                    if (typeof err.parent !== "undefined" && (err.parent.errno == 1062 || err.parent.code == 23505)) {
                        let err = new Error("structure.field.attributes.duplicateUnique");
                    } else if(typeof err.parent !== "undefined" && (err.parent.errno == 1146 || err.parent.code == "42P01" || err.parent.code == "3F000")){
                        // Handle case by Newmips, no worry about this one
                        if(['e_group', 'e_role', 'e_user'].indexOf(attr.name_data_entity) == -1 && attr.options.showValue == 'label'){
                            // Table do not exist - In case of script it's totally normal, just generate a warning
                            console.warn("WARNING - The database unique constraint on '"+attr.options.showValue+"' could not be applied, the corresponding table '"+sourceEntity+"' does not exist at the time of the instruction.");
                        }
                        structure_data_field.setUniqueField(attr, function (err) {
                            if (err)
                                return callback(err, null);

                            callback(null, {
                                message: "structure.field.attributes.successKnownAttributeWarning",
                                messageParams: [attr.options.showValue, attr.options.word]
                            });
                        });
                    } else {
                        callback(err, null);
                    }
                });
            } else {
                var err = new Error("structure.field.attributes.notUnderstandGiveAvailable");
                var msgParams = "";
                for (var i = 0; i < requiredAttribute.length; i++) {
                    msgParams += "-  " + requiredAttribute[i] + "<br>";
                }
                for (var j = 0; j < uniqueAttribute.length; j++) {
                    msgParams += "-  " + uniqueAttribute[j] + "<br>";
                }
                err.messageParams = [msgParams];
                callback(err, null);
            }
        });
    });
}

exports.setFieldAttribute = function (attr, callback) {
    db_entity.getDataEntityById(attr.id_data_entity, function (err, dataEntity) {
        if (err)
            return callback(err, null);

        attr.name_data_entity = dataEntity.codeName;

        structure_data_field.setFieldAttribute(attr, function (err) {
            if (err)
                return callback(err, null);

            callback(null, {
                message: "structure.field.attributes.success",
                messageParams: [attr.options.showValue, attr.options.word, attr.options.attributeValue]
            });
        });
    });
}
/* --------------------------------------------------------------- */
/* -------------------------- Datalist --------------------------- */
/* --------------------------------------------------------------- */

exports.setColumnVisibility = function (attr, callback) {

    db_entity.getDataEntityById(attr.id_data_entity, function (err, dataEntity) {
        if (err)
            return callback(err);

        attr.name_data_entity = dataEntity.codeName;
        structure_ui.setColumnVisibility(attr, function (err, infoStructure) {
            if (err)
                return callback(err);

            return callback(null, infoStructure);
        });
    });
}

/* --------------------------------------------------------------- */
/* -------------------- ASSOCIATION / RELATION ------------------- */
/* --------------------------------------------------------------- */

// Create a tab with an add button to create one new object associated to source entity
exports.createNewHasOne = function (attr, callback) {

    /* Check if entity source exist before doing anything */
    db_entity.getIdDataEntityByCodeName(attr.id_module, attr.options.source, function (err, idEntitySource) {
        if (err) {return callback(err, null);}
        var info = {};
        var toSync = true;
        let constraints = true;
        // For the newmips generator BDD, needed for db_field.createNewForeignKey
        attr.id_data_entity = idEntitySource;

        // Vérifie que la target existe bien avant de creer la source et la clé étrangère (foreign key)
        // Check if we have to create sub entity or not
        let checkEntityExisting = new Promise(function(resolve, reject){
            db_entity.selectEntityTarget(attr, function (err, dataEntity) {
                if (err) {
                    //Si c'est bien l'error de data entity qui n'existe pas
                    if (err.level == 0) {
                        // Si l'entité target n'existe pas, on la crée
                        db_entity.createNewEntityTarget(attr, function (err, created_dataEntity) {
                            if (err) {
                                return callback(err, null);
                            }

                            // On se dirige en sessions vers l'entité crée
                            //info = created_dataEntity;
                            // Stay on the source entity, even if the target has been created
                            info.insertId = attr.id_data_entity;

                            info.message = "structure.association.hasOne.successSubEntity";
                            info.messageParams = [attr.options.showAs, attr.options.showSource, attr.options.showSource, attr.options.showAs];
                            db_module.getModuleById(attr.id_module, function (err, module) {
                                if (err) {return reject(err);}
                                attr.show_name_module = module.name;
                                attr.name_module = module.codeName;

                                // Création de l'entité target dans le workspace
                                structure_data_entity.setupDataEntity(attr, function (err, data) {
                                    if (err) {return reject(err);}
                                    resolve(attr);
                                });
                            });

                        });
                    } else {reject(err);}
                } else {
                    // KEEP - Select the target if it already exist
                    //info.insertId = dataEntity.id;
                    // KEEP - Stay on the source entity
                    info.insertId = attr.id_data_entity;

                    info.message = "structure.association.hasOne.successEntity";
                    info.messageParams = [attr.options.showAs, attr.options.showSource, attr.options.showSource, attr.options.showAs];
                    resolve(attr);
                }
            })
        })

        checkEntityExisting.then(attr => {
            // Check already existing relation from source to target
            let sourceOptionsPath = __dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.source.toLowerCase() + '.json';
            var optionsSourceFile = helpers.readFileSyncWithCatch(sourceOptionsPath);
            var optionsSourceObject = JSON.parse(optionsSourceFile);
            let saveFile = false;
            // Vérification si une relation existe déjà de la source VERS la target
            for (var i = 0; i < optionsSourceObject.length; i++) {
                if (optionsSourceObject[i].target.toLowerCase() == attr.options.target.toLowerCase()) {
                    // If alias already used
                    if (attr.options.as == optionsSourceObject[i].as){
                        if(optionsSourceObject[i].structureType == "auto_generate") {
                            // Remove auto generate key by the generator
                            optionsSourceObject.splice(i, 1);
                            saveFile = true;
                        } else {
                            var err = new Error("structure.association.error.alreadySameAlias");
                            return callback(err, null);
                        }
                    }
                } else if(attr.options.as == optionsSourceObject[i].as){
                    let err = new Error();
                    err.message = "database.field.error.alreadyExist";
                    err.messageParams = [attr.options.showAs];
                    return callback(err, null);
                }
            }

            // Changes to be saved, remove auto_generate key
            if(saveFile)
                fs.writeFileSync(sourceOptionsPath, JSON.stringify(optionsSourceObject, null, 4), "utf8");

            // Check already existing relation from target to source
            var optionsFile = helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.target.toLowerCase() + '.json');
            var targetOptionsObject = JSON.parse(optionsFile);
            for (var i = 0; i < targetOptionsObject.length; i++) {
                if (targetOptionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && targetOptionsObject[i].relation != "hasMany" && targetOptionsObject[i].relation != "belongsToMany") {
                    // Remove constraint to accept circular belongsTo
                    constraints = false;
                } else if (attr.options.source.toLowerCase() != attr.options.target.toLowerCase()
                        && (targetOptionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && targetOptionsObject[i].relation == "hasMany")
                        && (targetOptionsObject[i].foreignKey == attr.options.foreignKey)) {
                    // We avoid the toSync to append because the already existing has many relation has already created the foreing key in BDD
                    toSync = false;
                }

                if (attr.options.source.toLowerCase() != attr.options.target.toLowerCase()
                        && (targetOptionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && targetOptionsObject[i].relation == "hasMany")
                        && (targetOptionsObject[i].foreignKey == attr.options.foreignKey)) {
                    // We avoid the toSync to append because the already existing has many relation has already created the foreing key in BDD
                    toSync = false;
                }
            }

            // Add the foreignKet reference in generator database
            db_field.createNewForeignKey(attr, function (err, created_foreignKey) {
                if (err) {return callback(err, null);}
                var associationOption = {
                    idApp: attr.id_application,
                    source: attr.options.source,
                    target: attr.options.target,
                    foreignKey: attr.options.foreignKey,
                    as: attr.options.as,
                    showAs: "",
                    relation: "belongsTo",
                    through: null,
                    toSync: toSync,
                    type: "hasOne",
                    constraints: constraints
                };

                var reversedOption = {
                    idApp: attr.id_application,
                    source: attr.options.target,
                    target: attr.options.source,
                    foreignKey: attr.options.foreignKey,
                    as: "r_"+attr.options.source.substring(2),
                    relation: "hasMany",
                    type: "auto_generate",
                    constraints: constraints
                };
                // Create belongsTo association between source and target
                structure_data_entity.setupAssociation(associationOption, function () {
                    // Create the opposite hasMany association
                    structure_data_entity.setupAssociation(reversedOption, function () {
                        // Generator tabulation in display
                        structure_data_field.setupHasOneTab(attr, function (err, data) {
                            if (err)
                                return callback(err, null);
                            callback(null, info);
                        })
                    })
                })
            })
        }).catch(err => {
            callback(err, null);
        })
    })
}

function belongsToMany(attr, optionObj, setupFunction, exportsContext) {
    return new Promise(function (resolve, reject) {
        attr.options.through = attr.id_application + "_" + attr.options.source + "_" + attr.options.target;
        var through = attr.options.through;

        /* First we have to save the already existing data to put them in the new relation */
        db_entity.retrieveWorkspaceHasManyData(attr.id_application, attr.options.source, optionObj.foreignKey, function (data, err) {
            if (err && err.code != "ER_NO_SUCH_TABLE")
                return reject(err);
            structure_data_field.saveHasManyData(attr, data, optionObj.foreignKey, function (data, err) {
                if (err)
                    return reject(err);
                /* Secondly we have to remove the already existing has many to create the belongs to many relation */
                var instructions = [
                    "select entity " + attr.options.showTarget
                ];

                var setRequired = false;

                if (optionObj.structureType == "relatedToMultiple" || optionObj.structureType == "relatedToMultipleCheckbox") {
                    instructions.push("delete field " + optionObj.as.substring(2));
                    // If related to is required, then rebuilt it required
                    if(optionObj.allowNull === false)
                        setRequired = true;
                } else {
                    instructions.push("delete tab " + optionObj.as.substring(2));
                }

                // Start doing necessary instruction for component creation
                exportsContext.recursiveInstructionExecute(attr, instructions, 0, function (err, infoInstruction) {
                    if (err)
                        return reject(err);
                    if (typeof infoInstruction.tabType !== "undefined")
                        attr.targetType = infoInstruction.tabType;
                    else
                        attr.targetType = optionObj.structureType;
                    /* Then lets create the belongs to many association */

                    /* We need the same alias for both relation */
                    //attr.options.as = "r_"+attr.options.source.substring(2)+ "_" + attr.options.target.substring(2);

                    var associationOptionOne = {
                        idApp: attr.id_application,
                        source: attr.options.source,
                        target: attr.options.target,
                        foreignKey: attr.options.foreignKey,
                        as: attr.options.as,
                        showAs: attr.options.showAs,
                        relation: "belongsToMany",
                        through: through,
                        toSync: false,
                        type: attr.targetType,
                        usingField: attr.options.usingField || undefined,
                    };
                    structure_data_entity.setupAssociation(associationOptionOne, function () {
                        var associationOptionTwo = {
                            idApp: attr.id_application,
                            source: attr.options.target,
                            target: attr.options.source,
                            foreignKey: attr.options.foreignKey,
                            as: optionObj.as,
                            showAs: optionObj.showAs,
                            relation: "belongsToMany",
                            through: through,
                            toSync: false,
                            type: attr.targetType,
                            usingField: optionObj.usingField || undefined,
                        };
                        structure_data_entity.setupAssociation(associationOptionTwo, function () {
                            structure_data_field[setupFunction](attr, function () {
                                var reversedAttr = {
                                    options: {
                                        target: attr.options.source,
                                        source: attr.options.target,
                                        foreignKey: optionObj.foreignKey,
                                        as: optionObj.as,
                                        showTarget: attr.options.showSource,
                                        urlTarget: attr.options.urlSource.toLowerCase(),
                                        showSource: attr.options.showTarget,
                                        urlSource: attr.options.urlTarget.toLowerCase(),
                                        showAs: optionObj.showAs,
                                        urlAs: optionObj.as.substring(2).toLowerCase()
                                    },
                                    id_project: attr.id_project,
                                    id_application: attr.id_application,
                                    id_module: attr.id_module,
                                    id_data_entity: attr.id_data_entity
                                };

                                // { function: 'createNewHasManyPreset',
                                //   options: 
                                //    { target: 'e_user',
                                //      source: 'e_projet',
                                //      foreignKey: 'fk_id_projet_participant_using_login',
                                //      as: 'r_participant_using_login',
                                //      processValue: true,
                                //      showTarget: 'User',
                                //      urlTarget: 'user',
                                //      showSource: 'Projet',
                                //      urlSource: 'projet',
                                //      showForeignKey: 'id_projet_participant using login',
                                //      showAs: 'Participant using Login',
                                //      urlAs: 'participant_using_login',
                                //      through: '11_e_projet_e_user' },
                                //   instruction: 'entity Projet has many existing User called Participant using Login',
                                //   id_project: 11,
                                //   id_application: 11,
                                //   id_module: 30,
                                //   id_data_entity: 147,
                                //   googleTranslate: false,
                                //   lang_user: 'fr-FR',
                                //   currentUser: 
                                //    { id: 1,
                                //      email: 'admin@admin.fr',
                                //      enabled: true,
                                //      first_name: 'admin',
                                //      last_name: 'NEWMIPS',
                                //      login: 'admin',
                                //      password: '$2a$10$h2kI8qTdNqlh64FeqzRGjOVzhRGr60xf5b/JCL/R.y4747uvSwj1u',
                                //      phone: null,
                                //      token_password_reset: null,
                                //      version: 1,
                                //      id_role: 1 },
                                //   gitlabUser: null,
                                //   targetType: 'auto_generate' }


                                if (attr.targetType == "hasMany") {
                                    structure_data_field.setupHasManyTab(reversedAttr, function () {
                                        resolve();
                                    });
                                } else if (attr.targetType == "hasManyPreset") {
                                    structure_data_field.setupHasManyPresetTab(reversedAttr, function () {
                                        resolve();
                                    });
                                } else if (attr.targetType == "relatedToMultiple" || attr.targetType == "relatedToMultipleCheckbox") {
                                    if (typeof optionObj.usingField !== "undefined")
                                        reversedAttr.options.usingField = optionObj.usingField;
                                    structure_data_field.setupRelatedToMultipleField(reversedAttr, function () {
                                        if(setRequired){
                                            reversedAttr.name_data_entity = reversedAttr.options.source;
                                            reversedAttr.options.value = "f_"+reversedAttr.options.urlAs;
                                            reversedAttr.options.word = "required";
                                            structure_data_field.setRequiredAttribute(reversedAttr, function () {
                                                resolve();
                                            });
                                        } else
                                            resolve();
                                    });
                                } else {
                                    let err = new Error();
                                    err.message = "Unknown target type for belongsToMany generation."
                                    reject(err);
                                }
                            });
                        });
                    });
                });
            });
        });
    });
}

// Create a tab with an add button to create multiple new object associated to source entity
exports.createNewHasMany = function (attr, callback) {
    var exportsContext = this;
    /* Check if entity source exist before doing anything */
    db_entity.getIdDataEntityByCodeNameWithoutModuleCheck(attr.id_module, attr.options.source, function (err, idEntitySource) {
        if (err)
            return callback(err, null);

        attr.id_data_entity = idEntitySource;

        let sourceOptionsPath = __dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.source.toLowerCase() + '.json';
        var optionsSourceFile = helpers.readFileSyncWithCatch(sourceOptionsPath);
        var optionsSourceObject = JSON.parse(optionsSourceFile);
        let saveFile = false;
        // Vérification si une relation existe déjà de la source VERS la target
        for (var i = 0; i < optionsSourceObject.length; i++) {
            if (optionsSourceObject[i].target.toLowerCase() == attr.options.target.toLowerCase()) {
                // If alias already used
                if (attr.options.as == optionsSourceObject[i].as){
                    if(optionsSourceObject[i].structureType == "auto_generate") {
                        // Remove auto generate key by the generator
                        optionsSourceObject.splice(i, 1);
                        saveFile = true;
                    } else {
                        var err = new Error("structure.association.error.alreadySameAlias");
                        return callback(err, null);
                    }
                }
            } else if(attr.options.as == optionsSourceObject[i].as){
                let err = new Error();
                err.message = "database.field.error.alreadyExist";
                err.messageParams = [attr.options.showAs];
                return callback(err, null);
            }
        }

        // Changes to be saved, remove auto_generate key
        if(saveFile)
            fs.writeFileSync(sourceOptionsPath, JSON.stringify(optionsSourceObject, null, 4), "utf8");

        var info = {};
        var toSync = true;
        var optionsObject;

        // Vérifie que la target existe bien avant de creer la source et la clé étrangère (foreign key)
        let checkExistEntity = new Promise((resolve, reject) => {
            db_entity.selectEntityTarget(attr, function (err, dataEntity) {
                // Si l'entité target n'existe pas, on la crée
                if (err) {
                    //Si c'est bien l'error de data entity qui n'existe pas
                    if (err.level == 0) {
                        db_entity.createNewEntityTarget(attr, function (err, created_dataEntity) {
                            if (err) {
                                return reject(err);
                            }
                            // KEEP - On se dirige en sessions vers l'entité crée
                            //info = created_dataEntity;

                            // KEEP - Stay on the source entity, even if the target has been created
                            info.insertId = attr.id_data_entity;

                            info.message = "structure.association.hasMany.successSubEntity";
                            info.messageParams = [attr.options.showAs, attr.options.showSource, attr.options.showSource, attr.options.showAs];

                            db_module.getModuleById(attr.id_module, function (err, module) {
                                if (err) {
                                    return reject(err);
                                }
                                attr.show_name_module = module.name;
                                attr.name_module = module.codeName;

                                // Création de l'entité target dans le workspace
                                structure_data_entity.setupDataEntity(attr, function (err, data) {
                                    if (err) {
                                        return reject(err);
                                    }
                                    var optionsFile = helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.target.toLowerCase() + '.json');
                                    optionsObject = JSON.parse(optionsFile);
                                    resolve(attr);
                                });
                            });
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    // KEEP - Select the target if it already exist
                    //info.insertId = dataEntity.id;
                    var optionsFile = helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.target.toLowerCase() + '.json');
                    optionsObject = JSON.parse(optionsFile);
                    var cptExistingHasMany = 0;

                    // Check if there is no or just one belongsToMany to do
                    for (var i = 0; i < optionsObject.length; i++) {
                        if (optionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && optionsObject[i].relation != "belongsTo") {
                            if (optionsObject[i].relation != "belongsToMany") {
                                cptExistingHasMany++;
                            }
                        }
                    }
                    /* If there are multiple has many association from target to source we can't handle on which one we gonna link the belongsToMany association */
                    if (cptExistingHasMany > 1) {
                        var err = new Error("structure.association.error.tooMuchHasMany");
                        return reject(err);
                    }
                    // KEEP - Stay on the source entity
                    info.insertId = attr.id_data_entity;

                    info.message = "structure.association.hasMany.successEntity";
                    info.messageParams = [attr.options.showAs, attr.options.showSource, attr.options.showSource, attr.options.showAs];
                    resolve(attr);
                }
            })
        })

        checkExistEntity.then(attr => {
            var doingBelongsToMany = false;
            // Vérification si une relation existe déjà de la target VERS la source
            for (var i = 0; i < optionsObject.length; i++) {
                if (optionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase()
                    && optionsObject[i].target.toLowerCase() != attr.options.target.toLowerCase()
                    && optionsObject[i].relation != "belongsTo"
                    && optionsObject[i].structureType != "auto_generate") {

                    doingBelongsToMany = true;
                    /* Then lets create the belongs to many association */
                    belongsToMany(attr, optionsObject[i], "setupHasManyTab", exportsContext).then(function () {
                        info.insertId = attr.id_data_entity;
                        info.message = "structure.association.hasMany.successEntity";
                        info.messageParams = [attr.options.showAs, attr.options.showSource, attr.options.showSource, attr.options.showAs];
                        callback(null, info);
                    }).catch(function (err) {
                        console.error(err);
                        return callback(err, null);
                    });
                } else if (attr.options.source.toLowerCase() != attr.options.target.toLowerCase()
                        && (optionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && optionsObject[i].relation == "belongsTo")
                        && (optionsObject[i].foreignKey == attr.options.foreignKey)) {
                    // We avoid the toSync to append because the already existing has one relation has already created the foreign key in BDD
                    toSync = false;
                }
            }

            // If there is a circular has many we have to convert it to a belongsToMany assocation, so we stop the code here.
            // If not we continue doing a simple has many association.
            if (!doingBelongsToMany) {
                var reversedAttr = {
                    options: {
                        source: attr.options.target,
                        showSource: attr.options.showTarget,
                        urlSource: attr.options.urlTarget,
                        target: attr.options.source,
                        showTarget: attr.options.showSource,
                        urlTarget: attr.options.urlSource
                    },
                    id_data_entity: attr.id_data_entity,
                    id_module: attr.id_module,
                    id_application: attr.id_application
                };

                db_field.createNewForeignKey(reversedAttr, function (err, created_foreignKey) {
                    if (err) {return callback(err, null);}
                    // Créer le lien hasMany en la source et la target
                    var associationOption = {
                        idApp: attr.id_application,
                        source: attr.options.source,
                        target: attr.options.target,
                        foreignKey: attr.options.foreignKey,
                        as: attr.options.as,
                        showAs: attr.options.showAs,
                        relation: "hasMany",
                        through: null,
                        toSync: toSync,
                        type: "hasMany"
                    };

                    let reversedOptions = {
                        idApp: attr.id_application,
                        source: attr.options.target,
                        target: attr.options.source,
                        foreignKey: attr.options.foreignKey,
                        as: "r_"+attr.options.source.substring(2),
                        relation: "belongsTo",
                        toSync: toSync,
                        type: "auto_generate"
                    }

                    // Generate hasMany relation in options
                    structure_data_entity.setupAssociation(associationOption, () => {
                        // Generate opposite belongsTo relation in options
                        structure_data_entity.setupAssociation(reversedOptions, () => {
                            // Ajouter le field d'assocation dans create_fields/update_fields. Ajout d'un tab dans le show
                            structure_data_field.setupHasManyTab(attr, () => {
                                callback(null, info);
                            });
                        });
                    });
                });
            }
        }).catch(err => {
            return callback(err, null);
        })
    })
}

// Create a tab with a select of existing object and a list associated to it
exports.createNewHasManyPreset = function (attr, callback) {
    var exportsContext = this;
    /* Check if entity source exist before doing anything */
    db_entity.getIdDataEntityByCodeNameWithoutModuleCheck(attr.id_module, attr.options.source, function (err, idEntitySource) {
        if (err)
            return callback(err, null);

        attr.id_data_entity = idEntitySource;

        var allUsingExist = true;
        // If a using field or fields has been asked, we have to check if those fields exist in the entity
        if (typeof attr.options.usingField !== "undefined") {
            var attributesPath = __dirname + '/../workspace/' + attr.id_application + '/models/attributes/' + attr.options.target.toLowerCase()
            delete require.cache[require.resolve(attributesPath)];
            var attributeTarget = require(attributesPath);
            for (var i = 0; i < attr.options.usingField.length; i++) {
                if (typeof attributeTarget[attr.options.usingField[i]] === "undefined") {
                    allUsingExist = false;
                    var missingField = attr.options.showUsingField[i];
                } else {
                    attr.options.usingField[i] = {
                        value: attr.options.usingField[i],
                        type: attributeTarget[attr.options.usingField[i]].newmipsType
                    }
                }
            }
        }
        // If a asked using field doesn't exist in the target entity we send an error
        if (!allUsingExist) {
            var err = new Error();
            err.message = "structure.association.relatedTo.missingField";
            err.messageParams = [missingField, attr.options.showTarget];
            return callback(err, null);
        }

        // With preset instruction with already know the source of the related to
        // "entity (.*) has many preset (.*)"
        if (typeof attr.options.source === "undefined") {
            attr.options.source = source_entity.codeName;
            attr.options.showSource = source_entity.name;
            attr.options.urlSource = attrHelper.removePrefix(source_entity.codeName, "entity");
        }

        // Vérifie que la target existe bien avant de creer la source et la clé étrangère (foreign key)
        db_entity.selectEntityTarget(attr, function (err, entityTarget) {
            // Si l'entité target n'existe pas ou autre
            if (err)
                return callback(err, null);

            let sourceOptionsPath = __dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.source.toLowerCase() + '.json';
            let optionsSourceFile = helpers.readFileSyncWithCatch(sourceOptionsPath);
            let optionsSourceObject = JSON.parse(optionsSourceFile);
            let toSync = true;
            let saveFile = false;
            // Vérification si une relation existe déjà avec cet alias
            for (var i = 0; i < optionsSourceObject.length; i++) {
                if (optionsSourceObject[i].target.toLowerCase() == attr.options.target.toLowerCase()) {
                    // If alias already used
                    if (attr.options.as == optionsSourceObject[i].as){
                        if(optionsSourceObject[i].structureType == "auto_generate") {
                            // Remove auto generate key by the generator
                            optionsSourceObject.splice(i, 1);
                            saveFile = true;
                        } else {
                            var err = new Error("structure.association.error.alreadySameAlias");
                            return callback(err, null);
                        }
                    }
                } else if(attr.options.as == optionsSourceObject[i].as){
                    let err = new Error();
                    err.message = "database.field.error.alreadyExist";
                    err.messageParams = [attr.options.showAs];
                    return callback(err, null);
                }
            }

            attr.options.through = attr.id_application + "_" + idEntitySource + "_" + entityTarget.id + "_" + attr.options.as.substring(2);
            if (attr.options.through.length > 55) {
                let err = new Error();
                err.message = "error.valueTooLong";
                err.messageParams = [attr.options.through];
                return callback(err, null);
            }

            // Changes to be saved, remove auto_generate key
            if(saveFile)
                fs.writeFileSync(sourceOptionsPath, JSON.stringify(optionsSourceObject, null, 4), "utf8")

            let optionsFile = helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.target.toLowerCase() + '.json');
            let targetOptions = JSON.parse(optionsFile);
            let cptExistingHasMany = 0;

            // Preparing variable
            let source = attr.options.source.toLowerCase();
            let target = attr.options.target.toLowerCase();

            // Check if there is no or just one belongsToMany to do
            for (let i = 0; i < targetOptions.length; i++)
                if (targetOptions[i].target.toLowerCase() == source && targetOptions[i].relation != "belongsTo")
                    cptExistingHasMany++;

            /* If there are multiple has many association from target to source we can't handle on which one we gonna link the belongsToMany association */
            if (cptExistingHasMany > 1) {
                let err = new Error("structure.association.error.tooMuchHasMany");
                return callback(err, null);
            }

            let doingBelongsToMany = false, targetObjTarget;
            // Vérification si une relation existe déjà de la target VERS la source
            for (let i = 0; i < targetOptions.length; i++) {
                targetObjTarget = targetOptions[i].target.toLowerCase();

                if (targetObjTarget == source
                    && targetObjTarget != target
                    && targetOptions[i].relation != "belongsTo"
                    && targetOptions[i].structureType != "auto_generate") {

                    doingBelongsToMany = true;
                    /* Then lets create the belongs to many association */
                    belongsToMany(attr, targetOptions[i], "setupHasManyPresetTab", exportsContext).then(function () {
                        let info = {};
                        info.insertId = attr.id_data_entity;
                        info.message = "structure.association.hasManyExisting.success";
                        info.messageParams = [attr.options.showTarget, attr.options.showSource];
                        callback(null, info);
                    }).catch(function (err) {
                        console.error(err);
                        return callback(err, null);
                    });
                } else if (source != target
                    && (targetObjTarget == source && targetOptions[i].relation == "belongsTo")
                    && targetOptions[i].foreignKey == attr.options.foreignKey) {
                    // We avoid the toSync to append because the already existing has one relation has already created the foreign key in BDD
                    toSync = false;
                }
            }

            // If there is a circular has many we have to convert it to a belongsToMany assocation, so we stop the code here.
            // If not we continue doing a simple has many association.
            if (!doingBelongsToMany) {
                db_field.createNewForeignKey(attr, function (err, created_foreignKey) {
                    if (err) {return callback(err, null);}

                    var associationOption = {
                        idApp: attr.id_application,
                        source: attr.options.source,
                        target: attr.options.target,
                        foreignKey: attr.options.foreignKey,
                        as: attr.options.as,
                        showAs: attr.options.showAs,
                        relation: "belongsToMany",
                        through: attr.options.through,
                        toSync: toSync,
                        usingField: attr.options.usingField || undefined,
                        type: "hasManyPreset"
                    };

                    // Créer le lien belongsTo en la source et la target
                    structure_data_entity.setupAssociation(associationOption, () => {
                        // Ajouter le field d'assocation dans create_fields/update_fields. Ajout d'un tab dans le show
                        structure_data_field.setupHasManyPresetTab(attr, () => {
                            var info = {};
                            info.insertId = attr.id_data_entity;
                            info.message = "structure.association.hasManyExisting.success";
                            info.messageParams = [attr.options.showTarget, attr.options.showSource];
                            callback(null, info);
                        })
                    })
                })
            }
        })
    })
}

// Create a field in create/show/update related to target entity
exports.createNewFieldRelatedTo = function (attr, callback) {
    // Check if a field with this name already exist
    db_field.getFieldByCodeName({
        codeName: 'f_' + attr.options.urlAs,
        idEntity: attr.id_data_entity
    }, (err, field) => {
        if(field){
            var err = new Error();
            err.message = "database.field.error.alreadyExist";
            err.messageParams = [attr.options.showAs];
            return callback(err, null);
        }
        // Instruction is add field _FOREIGNKEY_ related to _TARGET_ -> We don't know the source entity name
        db_entity.getDataEntityById(attr.id_data_entity, function (err, source_entity) {
            if (err && typeof attr.options.source === "undefined")
                return callback(err, null);
            // With preset instruction with already know the source of the related to
            // "entity (.*) has one preset (.*) called (.*) using (.*)"
            if (typeof attr.options.source === "undefined") {
                attr.options.source = source_entity.codeName;
                attr.options.showSource = source_entity.name;
                attr.options.urlSource = attrHelper.removePrefix(source_entity.codeName, "entity");
            }
            // Vérifie que la target existe bien avant de creer la source et la clé étrangère (foreign key)
            db_entity.selectEntityTarget(attr, function (err, dataEntity) {
                // If target entity doesn't exists, send error
                if (err)
                    return callback(err, null);
                var allUsingExist = true;
                // If a using field or fields has been asked, we have to check if those fields exist in the entity
                if (typeof attr.options.usingField !== "undefined") {
                    var attributesPath = __dirname + '/../workspace/' + attr.id_application + '/models/attributes/' + attr.options.target.toLowerCase()
                    delete require.cache[require.resolve(attributesPath)];
                    var attributeTarget = require(attributesPath);
                    for (var i = 0; i < attr.options.usingField.length; i++) {
                        if (typeof attributeTarget[attr.options.usingField[i]] === "undefined") {
                            allUsingExist = false;
                            var missingField = attr.options.showUsingField[i];
                        } else {
                            attr.options.usingField[i] = {
                                value: attr.options.usingField[i],
                                type: attributeTarget[attr.options.usingField[i]].newmipsType
                            }
                        }
                    }
                }
                // If a asked using field doesn't exist in the target entity we send an error
                if (!allUsingExist) {
                    var err = new Error("structure.association.relatedTo.missingField");
                    err.messageParams = [missingField, attr.options.showTarget];
                    return callback(err, null);
                }
                // Check if an association already exists from source to target
                let sourceOptionsPath = __dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.source.toLowerCase() + '.json';
                let optionsSourceObject = JSON.parse(helpers.readFileSyncWithCatch(sourceOptionsPath));
                let toSync = true;
                let constraints = true;
                let saveFile = false;
                // Check if an association already exists with the same alias
                for (var i = 0; i < optionsSourceObject.length; i++) {
                    if (optionsSourceObject[i].target.toLowerCase() == attr.options.target.toLowerCase()) {
                        // If alias already used
                        if (attr.options.as == optionsSourceObject[i].as){
                            if(optionsSourceObject[i].structureType == "auto_generate") {
                                // Remove auto generate key by the generator
                                optionsSourceObject.splice(i, 1);
                                saveFile = true;
                            } else
                                return callback(new Error("structure.association.error.alreadySameAlias"), null);
                        }
                    } else if(attr.options.as == optionsSourceObject[i].as){
                        let err = new Error();
                        err.message = "database.field.error.alreadyExist";
                        err.messageParams = [attr.options.showAs];
                        return callback(err, null);
                    }
                }

                // Changes to be saved, remove auto_generate key
                if(saveFile)
                    fs.writeFileSync(sourceOptionsPath, JSON.stringify(optionsSourceObject, null, 4), "utf8");

                // Check if an association already exists from target to source
                var optionsFile = helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.target.toLowerCase() + '.json');
                var optionsObject = JSON.parse(optionsFile);
                for (var i = 0; i < optionsObject.length; i++) {
                    if (optionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && optionsObject[i].relation != "hasMany" && optionsObject[i].relation != "belongsToMany") {
                        constraints = false;
                    } else if (attr.options.source.toLowerCase() != attr.options.target.toLowerCase()
                            && (optionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && optionsObject[i].relation == "hasMany")
                            && (optionsObject[i].foreignKey == attr.options.foreignKey)) {
                        // We avoid the toSync to append because the already existing has many relation has already created the foreign key in BDD
                        toSync = false;
                    }
                }
                // Add foreign key to newmips's DB
                db_field.createNewForeignKey(attr, function (err, created_foreignKey) {
                    if (err)
                        return callback(err, null);
                    // Créer le lien belongsTo en la source et la target dans models/options/source.json
                    var associationOption = {
                        idApp: attr.id_application,
                        source: attr.options.source,
                        target: attr.options.target,
                        foreignKey: attr.options.foreignKey,
                        as: attr.options.as,
                        showAs: attr.options.showAs,
                        relation: "belongsTo",
                        through: null,
                        toSync: true,
                        type: "relatedTo",
                        constraints: constraints
                    };
                    if (typeof attr.options.usingField !== "undefined") {
                        associationOption.usingField = attr.options.usingField;
                    }

                    var reversedOption = {
                        idApp: attr.id_application,
                        source: attr.options.target,
                        target: attr.options.source,
                        foreignKey: attr.options.foreignKey,
                        as: "r_"+attr.options.source.substring(2),
                        relation: "hasMany",
                        type: "auto_generate",
                        constraints: constraints
                    };
                    structure_data_entity.setupAssociation(associationOption, function () {
                        structure_data_entity.setupAssociation(reversedOption, function () {
                            // Ajouter le field d'assocation dans create_fields/update_fields. Ajout d'un tab dans le show
                            structure_data_field.setupRelatedToField(attr, function (err, data) {
                                if (err){return callback(err, null);}
                                // Stay on the source entity in session
                                var info = {};
                                info.insertId = attr.id_data_entity;
                                info.message = "structure.association.relatedTo.success";
                                info.messageParams = [attr.options.showAs, attr.options.showTarget, attr.options.showAs, attr.options.showAs, attr.options.showAs];
                                callback(null, info);
                            })
                        })
                    })
                })
            })
        });
    });
}

// Select multiple in create/show/update related to target entity
exports.createNewFieldRelatedToMultiple = function (attr, callback) {
    var exportsContext = this;
    // Check if a field with this name already exist
    db_field.getFieldByCodeName({
        codeName: 'f_' + attr.options.urlAs,
        idEntity: attr.id_data_entity
    }, (err, field) => {
        if(field){
            var err = new Error();
            err.message = "database.field.error.alreadyExist";
            err.messageParams = [attr.options.showAs];
            return callback(err, null);
        }
        // Instruction is add field _FOREIGNKEY_ related to multiple _TARGET_ -> We don't know the source entity name so we have to find it
        db_entity.getDataEntityById(attr.id_data_entity, (err, source_entity) => {
            if (err && typeof attr.options.source === "undefined")
                return callback(err, null);

            // With preset instruction with already know the source of the related to
            // "entity (.*) has one preset (.*) called (.*) using (.*)"
            if (typeof attr.options.source === "undefined") {
                attr.options.source = source_entity.codeName;
                attr.options.showSource = source_entity.name;
                attr.options.urlSource = attrHelper.removePrefix(source_entity.codeName, "entity");
            }

            // Now we know the source entity, so we can generate the foreign key
            attr.options.foreignKey = "fk_id_" + attr.options.source + "_" + attr.options.as.toLowerCase().substring(2);

            // Vérifie que la target existe bien avant de creer la source et la clé étrangère (foreign key)
            db_entity.selectEntityTarget(attr, (err, entityTarget) => {
                // If target entity doesn't exists, send error
                if (err)
                    return callback(err, null);

                var allUsingExist = true;

                // If a using field or fields has been asked, we have to check if those fields exist in the entity
                if (typeof attr.options.usingField !== "undefined") {
                    var attributesPath = __dirname + '/../workspace/' + attr.id_application + '/models/attributes/' + attr.options.target.toLowerCase()
                    delete require.cache[require.resolve(attributesPath)];
                    var attributeTarget = require(attributesPath);
                    for (var i = 0; i < attr.options.usingField.length; i++) {
                        if (typeof attributeTarget[attr.options.usingField[i]] === "undefined") {
                            allUsingExist = false;
                            var missingField = attr.options.showUsingField[i];
                        } else {
                            attr.options.usingField[i] = {
                                value: attr.options.usingField[i],
                                type: attributeTarget[attr.options.usingField[i]].newmipsType
                            }
                        }
                    }
                }

                // If a asked using field doesn't exist in the target entity we send an error
                if (!allUsingExist) {
                    var err = new Error("structure.association.relatedTo.missingField");
                    err.messageParams = [missingField, attr.options.showTarget];
                    return callback(err, null);
                }

                // Check if an association already exists from source to target
                var optionsSourceFile = helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.source.toLowerCase() + '.json');
                var optionsSourceObject = JSON.parse(optionsSourceFile);

                var toSync = true;
                var relation = "belongsToMany";

                // Check already exisiting association from source to target entity
                for (var i = 0; i < optionsSourceObject.length; i++) {
                    if (optionsSourceObject[i].target.toLowerCase() == attr.options.target.toLowerCase()) {
                        if (attr.options.as == optionsSourceObject[i].as) {
                            var err = new Error("structure.association.error.alreadySameAlias");
                            return callback(err, null);
                        }
                    } else if (optionsSourceObject[i].relation == "belongsToMany" && (attr.options.as == optionsSourceObject[i].as)) {
                        var err = new Error("structure.association.error.alreadySameAlias");
                        return callback(err, null);
                    } else if(attr.options.as == optionsSourceObject[i].as){
                        let err = new Error();
                        err.message = "database.field.error.alreadyExist";
                        err.messageParams = [attr.options.showAs];
                        return callback(err, null);
                    }
                }

                var info = {};
                attr.options.through = attr.id_application + "_" + source_entity.id + "_" + entityTarget.id + "_" + attr.options.as.substring(2);
                if (attr.options.through.length > 55) {
                    var err = new Error("error.valueTooLong");
                    err.messageParams = [attr.options.through];
                    return callback(err, null);
                }

                // Check if an association already exists from target to source
                var optionsFile = helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + attr.options.target.toLowerCase() + '.json');
                var optionsObject = JSON.parse(optionsFile);

                for (var i = 0; i < optionsObject.length; i++) {
                    if (optionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && optionsObject[i].relation != "belongsTo") {
                        attr.options.through = attr.id_application + "_" + entityTarget.id + "_" + source_entity.id + "_" + attr.options.as.substring(2);
                        if (attr.options.through.length > 55) {
                            var err = new Error("error.valueTooLong");
                            err.messageParams = [attr.options.through];
                            return callback(err, null);
                        }
                    } else if (attr.options.source.toLowerCase() != attr.options.target.toLowerCase()
                            && (optionsObject[i].target.toLowerCase() == attr.options.source.toLowerCase() && optionsObject[i].relation == "belongsTo")) {

                        // Temporary solution ! TODO: Mispy should ask if we want to link the already existing 1,1 with this new 1,n
                        if ((attr.options.target.substring(2) == attr.options.as.substring(2))
                                && (optionsObject[i].target.substring(2) == optionsObject[i].as.substring(2))) {
                            //&& (optionsObject[i].foreignKey == attr.options.foreignKey)
                            // If alias both side are the same that their own target then it trigger the 1,1 / 1,n generation
                            attr.options.foreignKey = optionsObject[i].foreignKey;
                            // We avoid the toSync to append because the already existing has one relation has already created the foreign key in BDD
                            toSync = false;
                            // If it's already define that target entity belongsTo source entity, then we create a simple hasMany instead of a belongsToMany
                            relation = "hasMany";
                            attr.options.through = null;
                        }
                    }
                }

                // If there is a circular has many we have to convert it to a belongsToMany assocation, so we stop the code here.
                // If not we continue doing a simple related to multiple association.
                var reversedAttr = {
                    options: {
                        showForeignKey: attr.options.showAs,
                        foreignKey: attr.options.foreignKey,
                        source: attr.options.source,
                    },
                    id_data_entity: attr.id_data_entity,
                    id_application: attr.id_application
                };

                db_field.createNewForeignKey(reversedAttr, (err, created_foreignKey) => {
                    if (err){return callback(err, null);}
                    // Create the belongsToMany link between source and target
                    var associationOption = {
                        idApp: attr.id_application,
                        source: attr.options.source,
                        target: attr.options.target,
                        foreignKey: attr.options.foreignKey,
                        as: attr.options.as,
                        showAs: attr.options.showAs,
                        relation: relation,
                        through: attr.options.through,
                        toSync: toSync,
                        type: attr.options.isCheckbox ? "relatedToMultipleCheckbox" : "relatedToMultiple"
                    };
                    if (typeof attr.options.usingField !== "undefined")
                        associationOption.usingField = attr.options.usingField;
                    if (typeof attr.options.isCheckbox !== "undefined" && attr.options.isCheckbox) {
                        // If it's a checkbox presentation style, we need to load association directly in the route, not in ajax
                        associationOption.loadOnStart = true;
                    }
                    structure_data_entity.setupAssociation(associationOption, () => {
                        // Ajouter le field d'assocation dans create_fields/update_fields. Ajout d'un tab dans le show
                        structure_data_field.setupRelatedToMultipleField(attr, () => {
                            var info = {};
                            info.message = "structure.association.relatedToMultiple.success";
                            info.messageParams = [attr.options.showAs, attr.options.showTarget, attr.options.showSource, attr.options.showAs, attr.options.showAs];
                            callback(null, info);
                        });
                    });
                });
            });
        });
    });
}

/* --------------------------------------------------------------- */
/* -------------------------- COMPONENT -------------------------- */
/* --------------------------------------------------------------- */
exports.createNewComponentStatus = function (attr, callback) {
    var self = this;

    db_entity.getDataEntityById(attr.id_data_entity, function (err, source_entity) {
        if (err)
            return callback(err, null);

        db_field.createNewDataField({
            id_data_entity: attr.id_data_entity,
            options: {
                value: attr.options.value,
                showValue: attr.options.value.substring(2)
            }
        }, function (err, info) {
            if (err)
                return callback(err, null);

            attr.source = source_entity.codeName;
            attr.showSource = source_entity.name;
            attr.history_table_db_name = 'history_' + source_entity.id + '_' + info.insertId;
            attr.history_table = 'history_' + attr.source + '_' + attr.options.value;

            // These instructions create a has many with a new entity history_status
            // It also does a hasMany relation with e_status
            var instructions = [
                "entity " + source_entity.name + ' has many ' + attr.history_table_db_name + ' called History ' + attr.options.showValue,
                "select entity " + attr.history_table_db_name,
                "add field " + attr.options.showValue + " related to Status using name, color",
                "add field Comment with type text",
                "add field Modified by related to user using login",
                "entity status has many " + attr.history_table_db_name,
                "select entity " + source_entity.name,
                "add field " + attr.options.showValue + " related to Status using name"
            ];

            self.recursiveInstructionExecute(attr, instructions, 0, function (err) {
                if (err) {
                    return db_field.deleteDataFieldById(info.insertId, function () {
                        return callback(err, null);
                    });
                }

                structure_component.newStatus(attr, function (err) {
                    if (err) {
                        return db_field.deleteDataFieldById(info.insertId, function () {
                            return callback(err, null);
                        });
                    }
                    callback(null, {message: 'database.component.create.successOnEntity', messageParams: ['status', attr.options.showValue, attr.showSource]});
                });
            });
        });
    });
}

let workspacesModels = {};
function deleteComponentStatus(attr, callback) {

    let self = this;
    /* If there is no defined name for the module, set the default */
    if (typeof attr.options.value === "undefined") {
        attr.options.value = "s_status";
        attr.options.urlValue = "status";
        attr.options.showValue = "Status";
    }

    db_entity.getDataEntityById(attr.id_data_entity, (err, entity) => {
        if(err)
            return callback(err);

        db_field.getFieldByCodeName({
            codeName: attr.options.value,
            idEntity: attr.id_data_entity,
            showValue: attr.options.showValue,
            showEntity: entity.name,
        }, (err, field) => {
            if(err)
                return callback(err);

            // Looking for status & history status information in options.json
            let entityOptions = JSON.parse(helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + entity.codeName + '.json'));
            let historyInfo, statusFieldInfo;

            for(let option of entityOptions){
                if(option.as == 'r_'+attr.options.urlValue)
                    statusFieldInfo = option;

                if(option.as == 'r_history_'+attr.options.urlValue)
                    historyInfo = option;
            }

            let modelsPath = __dirname + '/../workspace/' + attr.id_application + '/models/';
            if(typeof workspacesModels[attr.id_application] === 'undefined'){
                delete require.cache[require.resolve(modelsPath)];
                workspacesModels[attr.id_application] = require(modelsPath);
            }
            let historyTableName = workspacesModels[attr.id_application]['E_' + historyInfo.target.substring(2)].getTableName();

            structure_component.deleteStatus({
                appID: attr.id_application,
                status_field: 's_'+attr.options.urlValue,
                fk_status: statusFieldInfo.foreignKey,
                entity: entity.codeName,
                historyName: historyInfo.target,
                historyTableName: historyTableName
            }).then(_ => {

                // Delete metadata in generator DB
                db_field.deleteDataField({
                    id_data_entity: attr.id_data_entity,
                    options: {
                        value: 's_'+attr.options.urlValue,
                        showValue: attr.options.urlValue
                    }
                }, err => {if(err) console.error(err);});

                db_field.deleteDataField({
                    id_data_entity: attr.id_data_entity,
                    options: {
                        value: statusFieldInfo.foreignKey,
                        showValue: statusFieldInfo.foreignKey
                    }
                }, err => {if(err) console.error(err);});

                callback(null, {
                    message: 'database.component.delete.success'
                })
            }).catch(err => {
                callback(err);
            })
        })
    })
}
exports.deleteComponentStatus = deleteComponentStatus;

// Componant that we can add on an entity to store local documents
exports.createNewComponentLocalFileStorage = function (attr, callback) {

    /* If there is no defined name for the module */
    if (typeof attr.options.value === "undefined") {
        attr.options.value = "c_local_file_storage_" + attr.id_data_entity;
        attr.options.urlValue = "local_file_storage_" + attr.id_data_entity;
        attr.options.showValue = "Local File Storage";
    } else {
        attr.options.value = attr.options.value + "_" + attr.id_data_entity;
        attr.options.urlValue = attr.options.urlValue + "_" + attr.id_data_entity;
    }

    // Check if component with this name is already created on this entity
    db_component.checkIfComponentCodeNameExistOnEntity(attr.options.value, attr.id_module, attr.id_data_entity, function (err, alreadyExist) {
        if (err)
            return callback(err, null);
        if (alreadyExist) {
            var err = new Error("structure.component.error.alreadyExistOnEntity");
            return callback(err, null);
        }
        // Check if a table as already the composant name
        db_entity.getDataEntityByCodeName(attr.id_application, attr.options.value, function (err, dataEntity) {
            if (dataEntity) {
                var err = new Error("structure.component.error.alreadyExistInApp");
                return callback(err, null);
            }
            // Get Data Entity Name needed for structure
            db_entity.getDataEntityById(attr.id_data_entity, function (err, sourceEntity) {
                attr.options.source = sourceEntity.codeName;
                attr.options.showSource = sourceEntity.name;
                attr.options.urlSource = attrHelper.removePrefix(sourceEntity.codeName, "entity");
                // Create the component in newmips database
                db_component.createNewComponentOnEntity(attr, function (err, info) {
                    if (err)
                        return callback(err, null);
                    // Setup the hasMany association in the source entity
                    try {
                        db_entity.createNewEntity(attr, function (err, infoDbEntity) {
                            var associationOption = {
                                idApp: attr.id_application,
                                source: attr.options.source,
                                target: attr.options.value.toLowerCase(),
                                foreignKey: "fk_id_" + attr.options.source.toLowerCase(),
                                as: attr.options.value.toLowerCase(),
                                showAs: attr.options.showValue,
                                relation: "hasMany",
                                through: null,
                                toSync: false,
                                type: 'localfilestorage'
                            };
                            structure_data_entity.setupAssociation(associationOption, function () {
                                // Get module info needed for structure
                                db_module.getModuleById(attr.id_module, function (err, module) {
                                    if (err)
                                        return callback(err, null);
                                    attr.options.moduleName = module.codeName;
                                    structure_component.newLocalFileStorage(attr, function (err) {
                                        if (err)
                                            return callback(err, null);

                                        callback(null, info);
                                    });
                                });
                            });
                        });
                    } catch (err) {
                        return callback(err, null);
                    }
                });
            });
        });
    });
}

// Componant to create a contact form in a module
exports.createNewComponentContactForm = function (attr, callback) {

    var exportsContext = this;

    /* If there is no defined name for the module */
    if (typeof attr.options.value === "undefined") {
        attr.options.value = "e_contact_form";
        attr.options.urlValue = "contact_form";
        attr.options.showValue = "Contact Form";
    }

    // Check if component with this name is already created in this module
    db_component.getComponentByCodeNameInModule(attr.id_module, attr.options.value, attr.options.showValue, function (err, component) {
        if (component) {
            var err = new Error("structure.component.error.alreadyExistOnModule");
            return callback(err, null);
        } else {
            // Check if a table as already the composant name
            db_entity.getDataEntityByCodeName(attr.id_application, attr.options.value, function (err, dataEntity) {
                if (dataEntity) {
                    err = new Error("structure.component.error.alreadyExistInApp");
                    return callback(err, null);
                } else {

                    attr.options.valueSettings = attr.options.value + "_settings";
                    attr.options.urlValueSettings = attr.options.urlValue + "_settings";
                    attr.options.showValueSettings = attr.options.showValue + " Settings";

                    var instructions = [
                        "add entity " + attr.options.showValue,
                        "add field Name",
                        "set field Name required",
                        "add field Sender with type email",
                        "set field Sender required",
                        "add field Recipient with type email",
                        "add field User related to user using login",
                        "add field Title",
                        "set field Title required",
                        "add field Content with type text",
                        "set field Content required",
                        "add entity " + attr.options.showValueSettings,
                        "add field Transport Host",
                        "add field Port with type number",
                        "add field Secure with type boolean and default value true",
                        "add field User",
                        "add field Pass",
                        "add field Form Recipient",
                        "set field Transport Host required",
                        "set field Port required",
                        "set field User required",
                        "set field Pass required",
                        "set field Form Recipient required"
                    ];


                    // Start doing necessary instruction for component creation
                    exportsContext.recursiveInstructionExecute(attr, instructions, 0, function (err) {
                        if (err)
                            return callback(err, null);

                        // Create the component in newmips database
                        db_component.createNewComponentOnModule(attr, function (err, info) {
                            if (err)
                                return callback(err, null);
                            // Get Module Name needed for structure
                            db_module.getModuleById(attr.id_module, function (err, module) {
                                if (err)
                                    return callback(err, null);

                                attr.options.moduleName = module.codeName;
                                structure_component.newContactForm(attr, function (err) {
                                    if (err)
                                        return callback(err, null);

                                    callback(null, info);
                                });
                            });
                        });
                    });
                }
            });
        }
    });
}

exports.deleteComponentContactForm = function (attr, callback) {

    var exportsContext = this;

    /* If there is no defined name for the module */
    if (typeof attr.options.value === "undefined") {
        attr.options.value = "e_contact_form";
        attr.options.urlValue = "contact_form";
        attr.options.showValue = "Contact Form";
    }

    // Check if component with this name is already created in this module
    db_component.getComponentByCodeNameInModule(attr.id_module, attr.options.value, attr.options.showValue, function (err, component) {
        if (err) {
            return callback(err, null);
        } else {
            attr.options.valueSettings = attr.options.value + "_settings";
            attr.options.urlValueSettings = attr.options.urlValue + "_settings";
            attr.options.showValueSettings = attr.options.showValue + " Settings";

            var instructions = [
                "delete entity " + attr.options.showValue,
                "delete entity " + attr.options.showValueSettings
            ];

            // Create a tmp route file to avoid error during the delete entity, this file was removed at the component generation
            fs.writeFileSync(__dirname + "/../workspace/" + attr.id_application + "/routes/" + attr.options.valueSettings + ".js", "", "utf-8");

            // Start doing necessary instructions for component deletion
            exportsContext.recursiveInstructionExecute(attr, instructions, 0, function (err) {
                if (err)
                    return callback(err, null);

                // Remove the component in newmips database
                db_component.deleteComponentOnModule(attr.options.value, attr.id_module, function (err, info) {
                    if (err)
                        return callback(err, null);

                    callback(null, {message: "database.component.delete.success"});
                });
            });
        }
    });
}

// Componant to create an agenda in a module
exports.createNewComponentAgenda = function (attr, callback) {

    var exportsContext = this;

    /* If there is no defined name for the module */
    if (typeof attr.options.value === "undefined") {
        attr.options.value = "c_agenda";
        attr.options.urlValue = "agenda";
        attr.options.showValue = "Agenda";
    }

    // Check if component with this name is already created on this module
    db_component.getComponentByCodeNameInModule(attr.id_module, attr.options.value, attr.options.showValue, function (err, component) {
        if (component) {
            var err = new Error("structure.component.error.alreadyExistOnModule");
            return callback(err, null);
        } else {

            var valueEvent = "e_" + attr.options.urlValue + "_event";
            var valueCategory = "e_" + attr.options.urlValue + "_category";

            var showValueEvent = attr.options.showValue + " Event";
            var showValueCategory = attr.options.showValue + " Category";

            var instructions = [
                "add entity " + showValueCategory,
                "add field Label",
                "add field Color with type color",
                "set field Label required",
                "set field Color required",
                "add entity " + showValueEvent,
                "add field Title",
                "add field Description with type text",
                "add field Place",
                "add field Start date with type datetime",
                "add field End date with type datetime",
                "add field All day with type boolean",
                "add field Category related to " + showValueCategory + " using Label",
                "add field Users related to many user using login, email",
                "set field Title required",
                "set field Start date required"
            ];

            // Start doing necessary instruction for component creation
            exportsContext.recursiveInstructionExecute(attr, instructions, 0, function (err) {
                if (err)
                    return callback(err, null);

                // Create the component in newmips database
                db_component.createNewComponentOnModule(attr, function (err, info) {
                    if (err)
                        return callback(err, null);

                    // Link new event entity to component
                    db_entity.addComponentOnEntityByCodeName(valueEvent, info.insertId, attr.id_module, function (err) {
                        // Link new category entity to component
                        db_entity.addComponentOnEntityByCodeName(valueCategory, info.insertId, attr.id_module, function (err) {
                            // Get Data Entity Name needed for structure
                            db_module.getModuleById(attr.id_module, function (err, module) {
                                if (err)
                                    return callback(err, null);
                                attr.options.moduleName = module.codeName;

                                structure_component.newAgenda(attr, function (err) {
                                    if (err)
                                        return callback(err, null);

                                    callback(null, info);
                                });
                            });
                        });
                    });
                });
            });
        }
    });
}

exports.deleteAgenda = function (attr, callback) {

    let exportsContext = this;

    /* If there is no defined name for the module */
    if (typeof attr.options.value === "undefined") {
        attr.options.value = "c_agenda";
        attr.options.urlValue = "agenda";
        attr.options.showValue = "Agenda";
    }

    // Check if component with this name is in this module
    db_component.getComponentByCodeNameInModule(attr.id_module, attr.options.value, attr.options.showValue, (err, component) => {
        if (!component) {
            let err = new Error("database.component.notFound.notFoundInModule");
            err.messageParams = [attr.options.showValue, attr.id_module];
            return callback(err, null);
        }

        let showValueEvent = attr.options.showValue + " Event";
        let showValueCategory = attr.options.showValue + " Category";

        let instructions = [
            "delete entity " + showValueCategory,
            "delete entity " + showValueEvent,
        ];

        // Start doing necessary instruction for component creation
        exportsContext.recursiveInstructionExecute(attr, instructions, 0, err => {
            if (err)
                return callback(err, null);

            // Create the component in newmips database
            db_component.deleteComponentOnModule(attr.options.value, attr.id_module, (err, info) => {
                if (err)
                    return callback(err, null);

                db_module.getModuleById(attr.id_module, (err, module) => {
                    if (err)
                        return callback(err, null);

                    attr.options.moduleName = module.codeName;
                    structure_component.deleteAgenda(attr, err => {
                        if (err)
                            return callback(err, null);

                        callback(null, {
                            message: "database.component.delete.success"
                        });
                    });
                });
            });
        });
    });
}

// Component to create a C.R.A module
exports.createNewComponentCra = function (attr, callback) {

    var exportsContext = this;

    // Check if component with this name is already created on this module
    db_module.getModuleById(attr.id_module, function (err, module) {
        if (err)
            return callback(err, null);

        attr.module = module;
        var instructions = [
            "add entity CRA Team",
            "add field Name",
            "set field Name required",
            "entity CRA Team has many preset user using login",
            "entity CRA Team has one CRA Calendar Settings",
            "select entity CRA Calendar Settings",
            "add field Monday with type boolean",
            "add field Tuesday with type boolean",
            "add field Wednesday with type boolean",
            "add field Thursday with type boolean",
            "add field Friday with type boolean",
            "add field Saturday with type boolean",
            "add field Sunday with type boolean",
            "entity CRA Team has many CRA Calendar Exception",
            "select entity CRA Calendar Exception",
            "add field Date with type date",
            "add field Label",
            "add entity CRA Activity",
            "add field Name",
            "set field Name required",
            "add field Description with type text",
            "add field Client",
            "add field Active with type boolean and default value true",
            "add entity CRA",
            "add field Month with type number",
            "add field Year with type number",
            "add field Open days in month with type number",
            "add field User validated with type boolean",
            "add field Admin validated with type boolean",
            "add field Notification admin with type text",
            "set icon calendar check o",
            "entity user has many CRA",
            "entity CRA has many CRA Task",
            "select entity CRA Task",
            "add field Date with type date",
            "add field Duration with type float",
            "entity CRA Task has one CRA Activity",
            "entity CRA has one user"
        ];

        // Start doing necessary instruction for component creation
        exportsContext.recursiveInstructionExecute(attr, instructions, 0, function (err) {
            if (err)
                return callback(err, null);

            // Add fieldset ID in user entity that already exist so toSync doesn't work
            //var request = "ALTER TABLE `"+attr.id_application+"_e_user` ADD `id_e_cra_team_users` INT DEFAULT NULL;";
            //sequelize.query(request).then(function(){
            structure_component.newCra(attr, function (err, infoStructure) {
                if (err)
                    return callback(err, null);
                callback(null, infoStructure);
            });
            //});
        });
    });
}

// Componant that we can add on an entity to store local documents
exports.createNewComponentPrint = function (attr, callback) {

    /* If there is no defined name for the module */
    if (typeof attr.options.value === "undefined") {
        attr.options.value = "c_print_" + attr.id_data_entity;
        attr.options.urlValue = "print_" + attr.id_data_entity;
        attr.options.showValue = "Print";
    } else {
        attr.options.value = attr.options.value + "_" + attr.id_data_entity;
        attr.options.urlValue = attr.options.urlValue + "_" + attr.id_data_entity;
    }

    // Check if component with this name is already created on this entity
    db_component.checkIfComponentCodeNameExistOnEntity(attr.options.value, attr.id_module, attr.id_data_entity, function (err, alreadyExist) {
        if (err)
            return callback(err, null);
        if (alreadyExist) {
            var err = new Error("structure.component.error.alreadyExistOnEntity");
            return callback(err, null);
        } else {
            // Get Data Entity Name needed for structure
            db_entity.getDataEntityById(attr.id_data_entity, function (err, sourceEntity) {
                attr.options.source = sourceEntity.codeName;
                attr.options.showSource = sourceEntity.name;
                attr.options.urlSource = attrHelper.removePrefix(sourceEntity.codeName, "entity");
                // Create the component in newmips database
                db_component.createNewComponentOnEntity(attr, function (err, info) {
                    if (err)
                        return callback(err, null);
                    try {
                        // Get module info needed for structure
                        db_module.getModuleById(attr.id_module, function (err, module) {
                            if (err)
                                return callback(err, null);
                            attr.options.moduleName = module.codeName;
                            structure_component.newPrint(attr, function (err) {
                                if (err)
                                    return callback(err, null);

                                callback(null, info);
                            });
                        });
                    } catch (err) {
                        return callback(err, null);
                    }
                });
            });
        }
    });
}

exports.deleteComponentPrint = function (attr, callback) {

    if (typeof attr.options.value === "undefined") {
        attr.options.value = "c_print_" + attr.id_data_entity;
        attr.options.urlValue = "print_" + attr.id_data_entity;
        attr.options.showValue = "Print";
    } else {
        attr.options.value = attr.options.value + "_" + attr.id_data_entity;
        attr.options.urlValue = attr.options.urlValue + "_" + attr.id_data_entity;
    }

    // Check if component with this name is already created on this entity
    db_component.checkIfComponentCodeNameExistOnEntity(attr.options.value, attr.id_module, attr.id_data_entity, function (err, exist) {
        if (err)
            return callback(err, null);
        if (exist) {
            // Get Data Entity Name needed for structure
            db_entity.getDataEntityById(attr.id_data_entity, function (err, sourceEntity) {
                attr.options.source = sourceEntity.codeName;
                attr.options.showSource = sourceEntity.name;
                attr.options.urlSource = attrHelper.removePrefix(sourceEntity.codeName, "entity");
                structure_component.deletePrint(attr, function (err) {
                    if (err)
                        return callback(err, null);
                    db_component.deleteComponentOnEntity(attr.options.value, attr.id_module, sourceEntity.id, function (err, infoDB) {
                        if (err) {
                            return callback(err, null);
                        }
                        callback(null, infoDB);
                    });
                });
            });
        } else {
            var err = new Error("structure.component.error.notExisting");
            return callback(err, null);
        }
    });
}

exports.createComponentChat = function (attr, callback) {
    structure_component.setupChat(attr, function (err) {
        if (err)
            return callback(err);
        callback(null, {message: 'structure.component.chat.success'});
    });
}

//Create new component address
exports.createNewComponentAddress = function(attr, callback) {
    var componentCodeName = 'e_address_' + attr.id_data_entity;

    if (attr.id_data_entity) {
        db_component.checkIfComponentCodeNameExistOnEntity(componentCodeName, attr.id_module, attr.id_data_entity, function(err, alreadyExist) {
            if (!err) {
                if (!alreadyExist) {
                    db_entity.getDataEntityById(attr.id_data_entity, function(err, entity) {
                        if (!err) {
                            attr.componentCodeName = componentCodeName;
                            attr.options.name = attr.options.componentName;
                            attr.entityCodeName = entity.codeName;
                            attr.componentName = attr.options.componentName;
                            attr.moduleName = module.codeName;
                            attr.options.showValue = attr.options.componentName;
                            attr.options.value = componentCodeName;
                            var associationOption = {
                                idApp: attr.id_application,
                                source: entity.codeName,
                                target: componentCodeName,
                                foreignKey: 'fk_id_address',
                                as: 'r_address',
                                showAs: "",
                                type: "relatedTo",
                                relation: "belongsTo",
                                targetType: "component",
                                toSync: true
                            };
                            structure_data_entity.setupAssociation(associationOption, function() {
                                attr.sourceEntity = entity.codeName;
                                attr.foreignKey = associationOption.foreignKey;
                                attr.targetEntity = componentCodeName;
                                attr.targetKey = 'id';
                                attr.constraintDelete = 'CASCADE';
                                attr.constraintUpdate = 'CASCADE';
                                attr.dropForeignKey = true;
                                db_component.createNewComponentOnEntity(attr, function(err, info) {
                                    if (!err) {
                                        structure_component.addNewComponentAddress(attr, function(err) {
                                            if (err)
                                                return callback(err);
                                            callback(null, {
                                                message: 'database.component.create.success',
                                                messageParams: ["Adresse", attr.options.componentName || '']
                                            });
                                        });
                                    } else
                                        return callback(err);
                                });
                            });
                        } else
                            return callback(err);
                    });
                } else {
                    var err = new Error("structure.component.error.alreadyExistOnEntity");
                    return callback(err, null);
                }
            } else
                return callback(err);
        });
    } else {
        var err = new Error("database.field.error.selectOrCreateBefore");
        return callback(err, null);
    }
}

exports.deleteComponentAddress = function (attr, callback) {
    var componentName = 'e_address_' + attr.id_data_entity;
    if (!attr.id_data_entity){
        var err = new Error("database.field.error.selectOrCreateBefore");
        return callback(err, null);
    }
    db_component.checkIfComponentCodeNameExistOnEntity(componentName, attr.id_module, attr.id_data_entity, function (err, componentExist) {
        if (err)
            return callback(err);
        if (!componentExist) {
            var err = new Error("database.component.notFound.notFoundInModule");
            return callback(err, null)
        }
        db_component.deleteComponentOnEntity(componentName, attr.id_module, attr.id_data_entity, function (err, info) {
            if (err)
                return callback(err);
            database.dropDataEntity(attr.id_application, componentName, function (err) {
                db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
                    if (err)
                        return callback(err);
                    attr.entityName = entity.codeName;
                    attr.moduleName = module.codeName;
                    structure_component.deleteComponentAddress(attr, function (err) {
                        if (err)
                            return callback(err);
                        attr.name_data_entity = attr.entityName;
                        attr.fieldToDrop = 'fk_id_address';
                        database.dropFKDataField(attr, function (err) {
                            callback(err, {message: 'database.component.delete.success'});
                        });
                    });
                });
            });
        });
    });
}
/************************Create Component Template document***********************/
/**
 *
 * @param {type} attr
 * @param {type} callback
 * @returns {callback}
 */
exports.createComponentDocumentTemplate = function (attr, callback) {
    var componentCodeName = 'c_document_template';
    var entity_code_name = 'e_document_template';
    var component_show_value = "Document template";
    //get Module Administration
    db_module.getModuleByCodename(attr.id_application, 'm_administration', function (err, module) {
        if (!err) {
            if (module) {
                attr.id_module = module.id;
                //check if entity is selected
                if (attr.id_data_entity) {
                    //get entity on which we will add component
                    db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
                        if (!err) {
                            /**
                             * Check if component exist On entity,
                             */
                            db_component.checkIfComponentCodeNameExistOnEntity(componentCodeName, entity.id_module, attr.id_data_entity, function (err, alreadyExist) {
                                if (!alreadyExist) {
                                    attr.options.value = componentCodeName;
                                    attr.options.showValue = component_show_value;
                                    db_component.getComponentByCodeNameInModule(attr.id_module, componentCodeName, component_show_value, function (err, component) {
                                        var p = new Promise(function (resolve, reject) {
                                            if (!component) {
                                                //component doesn't exist, so we create it
                                                db_component.createNewComponentOnModule(attr, function (err, info) {
                                                    //now we get It
                                                    db_component.getComponentByCodeNameInModule(attr.id_module, componentCodeName, component_show_value, function (err, component) {
                                                        resolve(component);
                                                    });
                                                });
                                            } else {
                                                //component exists
                                                resolve(component);
                                            }
                                        });
                                        p.then(function (component) {
                                            //add component on entity
                                            component.addDataEntity(attr.id_data_entity).then(function () {
                                                attr.moduleName = module.codeName;
                                                attr.entityName = entity.name;
                                                attr.options.target = componentCodeName;
                                                attr.options.source = entity.codeName;
                                                //check if entity document template exist
                                                db_entity.getIdDataEntityByCodeName(module.id, entity_code_name, function (err, id_entity) {
                                                    var p = new Promise(function (resolve, reject) {
                                                        if (err && err.message === "database.entity.notFound.withThisCodeNameAndModule") {
                                                            //entity Template document not found, we create it
                                                            attr.options.value = entity_code_name;
                                                            attr.options.showValue = component_show_value;
                                                            db_entity.createNewEntity(attr, function (err, info) {
                                                                if (err)
                                                                    reject(err);
                                                                else {
                                                                    //If new, we add structure files(models,route,views etc.)
                                                                    attr.is_new_component_entity = true;
                                                                    resolve(info.insertId);
                                                                }
                                                            });
                                                        } else if (!err) {
                                                            resolve(id_entity);
                                                        } else {
                                                            reject(err);
                                                        }
                                                    });
                                                    p.then(function (id_entity) {
                                                        attr.id_entity = id_entity;
                                                        /**
                                                         * Now add entity e_document_template files(models,views,routes)
                                                         */
                                                        structure_component.createComponentDocumentTemplate(attr, function (err) {
                                                            if (err)
                                                                return callback(err);
                                                            else
                                                                return callback(null, {message: 'database.component.create.success',
                                                                    messageParams: ["Document template", typeof attr.options.componentName !== "undefined" ? attr.options.componentName : "Document template"]});
                                                        });
                                                    }).catch(function (e) {
                                                        return callback(e);
                                                    });
                                                });
                                            }).catch(function (e) {
                                                return callback(e);
                                            });
                                        }).catch(function (e) {
                                            return callback(err);
                                        });
                                    });
                                } else {
                                    var err = new Error("structure.component.error.alreadyExistOnEntity");
                                    return callback(err, null);
                                }
                            });
                        } else
                            return callback(err);
                    });
                } else {
                    var err = new Error("database.field.error.selectOrCreateBefore");
                    return callback(err, null);
                }
            } else {
                /**Reject. We need module Administration to continue**/
                var err = new Error("database.module.notFound");
                return callback(err);
            }
        } else
            return callback(err);
    });
};

/**
 *
 * @param {type} attr
 * @param {type} callback
 */
exports.deleteComponentDocumentTemplate = function (attr, callback) {
    var componentName = "c_document_template";
    if (attr.id_data_entity) {
        db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
            if (!err) {
                attr.entityName = entity.codeName;
                db_component.checkIfComponentCodeNameExistOnEntity(componentName, entity.id_module, attr.id_data_entity, function (err, componentExist) {
                    if (!err) {
                        if (componentExist) {
                            //Get module administration where is component entity
                            db_module.getModuleByCodename(attr.id_application, 'm_administration', function (err, module) {
                                if (!err) {
                                    //Delete juste association
                                    db_component.deleteComponentAndEntityAssociation(componentName, module.id, attr.id_data_entity, function (err, info) {
                                        if (!err) {
                                            //Delete tab on entity
                                            structure_component.deleteComponentDocumentTemplateOnEntity(attr, function (err) {
                                                if (err)
                                                    return callback(err);
                                                else {
                                                    //delete the component files if no entity doesn't contain it, so we check it before
                                                    db_component.checkIfComponentCodeNameExistOnAnEntity(componentName, module.id, function (err, exist) {
                                                        if (!err) {
                                                            if (exist) {
                                                                //If another entity have this component whe don't delete files
                                                                return callback(null, {message: 'database.component.delete.success'});
                                                            } else {
                                                                //If not, we delete component files:model,route,views,...
                                                                db_entity.deleteDataEntity({id_module: module.id, show_name_data_entity: "document template", name_data_entity: 'e_document_template'}, function () {
                                                                    // We drop component entity table
                                                                    database.dropDataEntity(attr.id_application, 'e_document_template', function (err) {
                                                                        if (err)
                                                                            return callback(err);
                                                                        else {
                                                                            db_component.deleteComponentByCodeNameInModule("c_document_template", module.id, function () {
                                                                                if (!err) {
                                                                                    structure_component.deleteComponentDocumentTemplate(attr, function (err) {
                                                                                        //delete upload files ?
                                                                                        callback(err, {message: 'database.component.delete.success'});
                                                                                    });
                                                                                } else {
                                                                                    return callback(err);
                                                                                }
                                                                            });
                                                                        }
                                                                    });
                                                                });
                                                            }
                                                        } else
                                                            return callback(err);
                                                    });
                                                }
                                            });
                                        } else
                                            return callback(err);
                                    });
                                } else
                                    return callback(err);
                            });
                        } else {
                            var err = new Error("database.component.notFound.notFoundOnEntity");
                            err.messageParams = ["document template", attr.id_data_entity];
                            return callback(err, null);
                        }
                    } else
                        return callback(err);
                });
            } else
                return callback(err);
        });
    } else {
        var err = new Error("database.field.error.selectOrCreateBefore");
        return callback(err, null);
    }
};

/* --------------------------------------------------------------- */
/* -------------------------- INTERFACE -------------------------- */
/* --------------------------------------------------------------- */
exports.setLogo = function (attr, callback) {
    structure_ui.setLogo(attr, function (err, infoStructure) {
        if (err)
            return callback(err, null);
        callback(null, infoStructure);
    });
}

exports.removeLogo = function (attr, callback) {
    structure_ui.removeLogo(attr, function (err, infoStructure) {
        if (err)
            return callback(err, null);
        callback(null, infoStructure);
    });
}

exports.setLayout = function (attr, callback) {
    db_module.getModuleById(attr.id_module, function (err, currentModule) {
        if (err)
            return callback(err, null);
        attr.currentModule = currentModule;
        structure_ui.setLayout(attr, function (err, infoStructure) {
            if (err)
                return callback(err, null);
            callback(null, infoStructure);
        });
    });
}

exports.listLayout = function (attr, callback) {
    structure_ui.listLayout(attr, function (err, infoStructure) {
        if (err)
            return callback(err, null);

        callback(null, infoStructure);
    });
}

exports.setTheme = function (attr, callback) {
    structure_ui.setTheme(attr, function (err, infoStructure) {
        if (err)
            return callback(err, null);

        callback(null, infoStructure);
    });
}

exports.listTheme = function (attr, callback) {
    structure_ui.listTheme(attr, function (err, infoStructure) {
        if (err)
            return callback(err, null);

        callback(null, infoStructure);
    });
}

exports.listIcon = function (attr, callback) {
    callback(null, {
        message: "structure.ui.icon.list",
        messageParams: ['http://fontawesome.io/icons']
    });
}

exports.setIcon = function (attr, callback) {
    db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
        if (err)
            return callback(err);
        db_module.getModuleById(entity.id_module, function (err, module) {
            if (err)
                return callback(err);

            attr.module = module;
            attr.entity = entity;
            structure_ui.setIcon(attr, function (err, info) {
                if (err)
                    return callback(err);
                callback(null, info);
            });
        });
    });
}

exports.setIconToEntity = function (attr, callback) {
    db_entity.getEntityByName(attr.entityTarget, attr.id_module, function (err, entity) {
        if (err)
            return callback(err);
        db_module.getModuleById(entity.id_module, function (err, module) {
            if (err)
                return callback(err);

            attr.module = module;
            attr.entity = entity;
            structure_ui.setIcon(attr, function (err, info) {
                if (err)
                    return callback(err);
                callback(null, info);
            });
        });
    });
}

exports.addTitle = function (attr, callback) {
    // Get selected entity
    db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
        if (err)
            return callback(err, null);

        attr.entityCodeName = entity.codeName;

        let checkField = new Promise((resolve, reject) => {
            if(!attr.options.afterField)
                return resolve();

            attr.fieldCodeName = "f_"+attrHelper.clearString(attr.options.afterField);

            var checkFieldParams = {
                codeName: attr.fieldCodeName,
                showValue: attr.options.afterField,
                idEntity: attr.id_data_entity,
                showEntity: entity.name
            };

            db_field.getFieldByCodeName(checkFieldParams, function (err, fieldExist) {
                if (err) {
                    // Not found as a simple field, look for related to field
                    var optionsArray = JSON.parse(helpers.readFileSyncWithCatch(__dirname+'/../workspace/' + attr.id_application + '/models/options/' + entity.codeName + '.json'));
                    var found = false;
                    for (var i = 0; i < optionsArray.length; i++) {
                        if (optionsArray[i].showAs == attr.options.afterField) {
                            if (optionsArray[i].structureType == "relatedTo" || optionsArray[i].structureType == "relatedToMultiple" || optionsArray[i].structureType == "relatedToMultipleCheckbox") {
                                found = true;
                                return resolve();
                            }
                            break;
                        }
                    }
                    if (!found){
                        let err = new Error();
                        err.message = "structure.ui.title.missingField";
                        err.messageParams = [attr.options.afterField];
                        return reject(err);
                    }
                } else {
                    resolve();
                }
            })
        })

        checkField.then(() => {
            structure_ui.addTitle(attr, function (err, answer) {
                if (err)
                    return callback(err, null);

                callback(null, answer);
            })
        }).catch(err => {
            return callback(err, null);
        })
    })
}

exports.createWidgetPiechart = function (attr, callback) {
    var entityDbFunction = '', param = '';
    if (attr.entityTarget) {
        db_entity.getEntityByName(attr.entityTarget, attr.id_module, function (err, entity) {
            if (err)
                return callback(err);
            withDataEntity(entity);
        });
    } else {
        db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
            if (err)
                return callback(err);
            withDataEntity(entity);
        });
    }

    function withDataEntity(entity) {
        db_module.getModuleById(entity.id_module, function (err, module) {
            if (err)
                return callback(err);
            attr.entity = entity;
            attr.module = module;

            db_field.getCodeNameByNameArray([attr.field], entity.id, function (err, field) {
                if (err)
                    return callback(err);

                if (field.length == 1) {
                    attr.found = true;
                    attr.field = field[0];
                }
                // Field not found on entity, set found to false to notify structure_ui to search in entities targeted in options.json
                else
                    attr.found = false;

                structure_ui.createWidgetPiechart(attr, function (err, info) {
                    if (err)
                        return callback(err);
                    callback(null, info);
                });
            });
        });
    }
}

exports.createWidgetLastRecords = function (attr, callback) {
    if (attr.entityTarget) {
        db_entity.getEntityByName(attr.entityTarget, attr.id_module, function (err, entity) {
            if (err)
                return callback(err);
            withDataEntity(entity);
        });
    } else {
        db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
            if (err)
                return callback(err);
            withDataEntity(entity);
        });
    }

    function withDataEntity(entity) {
        db_module.getModuleById(entity.id_module, function (err, module) {
            if (err)
                return callback(err);
            attr.entity = entity;
            attr.module = module;

            db_field.getCodeNameByNameArray(attr.columns, entity.id, function (err, columns) {
                if (err)
                    return callback(err);
                // Check for not found fields and build error message
                for (var k = 0; k < attr.columns.length; k++) {
                    var kFound = false;
                    if (attr.columns[k].toLowerCase() == 'id') {
                        attr.columns[k] = {codeName: 'id', name: 'id', found:true};
                        kFound = true;
                        continue;
                    }
                    for (var i = 0; i < columns.length; i++) {
                        if (columns[i].codeName.indexOf('s_') == 0)
                            columns[i].codeName = 'r_'+columns[i].codeName.substring(2);
                        if (attr.columns[k].toLowerCase() == columns[i].name.toLowerCase()) {
                            attr.columns[k] = {codeName: columns[i].codeName, name: columns[i].name, found: true};
                            kFound = true;
                            break;
                        }
                    }
                    if (!kFound)
                        attr.columns[k] = {name: attr.columns[k], found: false};
                }
                structure_ui.createWidgetLastRecords(attr, function (err, info) {
                    if (err)
                        return callback(err);
                    callback(null, info);
                });
            });

        });
    }
}

exports.createWidgetOnEntity = function (attr, callback) {
    db_entity.getEntityByName(attr.entityTarget, attr.id_module, function (err, entity) {
        if (err)
            return callback(err);
        attr.id_data_entity = entity.id;
        createWidget(attr, callback);
    });
}

exports.apero = function (attr, callback) {
    // \o/
    callback(null, {
        message: "Santé !"
    });
}

function createWidget(attr, callback) {
    if (attr.widgetType == -1)
        return callback(null, {message: "structure.ui.widget.unknown", messageParams: [attr.widgetInputType]});

    db_entity.getDataEntityById(attr.id_data_entity, function (err, entity) {
        if (err)
            return callback(err);
        db_module.getModuleById(entity.id_module, function (err, module) {
            if (err)
                return callback(err);

            attr.module = module;
            attr.entity = entity;
            structure_ui.createWidget(attr, function (err, info) {
                if (err)
                    return callback(err);
                callback(null, info);
            });
        });
    });
}
exports.createWidget = createWidget;

function deleteWidget(attr, callback) {
    if (attr.widgetType == -1)
        return callback(null, {message: "structure.ui.widget.unkown", messageParams: [attr.widgetInputType]});
    db_entity.getEntityByName(attr.entityTarget, attr.id_module, function (err, entity) {
        if (err)
            return callback(err);
        db_module.getModuleById(entity.id_module, function (err, dbModule) {
            if (err)
                return callback(err);

            attr.module = dbModule;
            attr.entity = entity;

            structure_ui.deleteWidget(attr, function (err, info) {
                if (err)
                    return callback(err);
                callback(null, info);
            });
        });
    });
}
exports.deleteWidget = deleteWidget;

function deleteEntityWidgets(attr, callback) {
    attr.widgetTypes = ['info', 'stats', 'lastrecords', 'piechart'];
    deleteWidget(attr, function (err) {
        if (err)
            return callback(err);
        callback(null, {message: "structure.ui.widget.all_deleted", messageParams: [attr.entityTarget]});
    });
}
exports.deleteEntityWidgets = deleteEntityWidgets;
