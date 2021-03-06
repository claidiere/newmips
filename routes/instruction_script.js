const express = require('express');
const router = express.Router();
const multer = require('multer');
const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

const attrHelper = require('../utils/attr_helper');
const block_access = require('../utils/block_access');
const docBuilder = require('../utils/api_doc_builder');

const designer = require('../services/designer.js');
const session_manager = require('../services/session.js');
const parser = require('../services/bot.js');

const structure_application = require('../structure/structure_application');

let scriptProcessing = {
    timeout: moment(),
    state: false
};
let scriptData = {};
let message = "";

function execute(req, instruction) {
    return new Promise(function(resolve, reject) {
        var userId = req.session.passport.user.id;
        var __ = require("../services/language")(req.session.lang_user).__;
        try {

            /* Lower the first word for the basic parser jison */
            instruction = attrHelper.lowerFirstWord(instruction);

            var attr = parser.parse(instruction);

            /* Rework the attr to get value for the code / url / show */
            attr = attrHelper.reworkAttr(attr);

            attr.id_project = scriptData[userId].ids.id_project;
            attr.id_application = scriptData[userId].ids.id_application;
            attr.id_module = scriptData[userId].ids.id_module;
            attr.id_data_entity = scriptData[userId].ids.id_data_entity;
            attr.googleTranslate = req.session.toTranslate || false;
            attr.lang_user = req.session.lang_user;
            attr.currentUser = req.session.passport.user;

            if(typeof req.session.gitlab !== "undefined" && typeof req.session.gitlab.user !== "undefined" && !isNaN(req.session.gitlab.user.id))
                attr.gitlabUser = req.session.gitlab.user;
            else
                attr.gitlabUser = null;

            if (typeof attr.error !== 'undefined')
                throw new Error(attr.error);

            return designer[attr.function](attr, function(err, info) {
                if (err) {
                    // Error handling code goes here
                    scriptData[userId].answers.unshift({
                        instruction: instruction,
                        message: __(err.message, err.messageParams || [])
                    });
                    reject(err);
                } else {

                    // Store key entities in session for futur instruction
                    session_manager.setSessionForInstructionScript(attr.function, scriptData[userId], info);

                    scriptData[userId].answers.unshift({
                        instruction: instruction,
                        message: __(info.message, info.messageParams || [])
                    });
                    resolve();
                }

            });
        } catch (err) {
            scriptData[userId].answers.unshift({
                instruction: instruction,
                message: __(err.message, err.messageParams || [])
            });
            reject(err);
        }
    });
}

let mandatoryInstructions = [
    "create module home",
    "create module Administration",
    "create entity User",
    "add field login",
    "set field login required",
    "set field login unique",
    "add field password",
    "add field email with type email",
    "add field token_password_reset",
    "add field enabled with type number",
    "set icon user",
    "create entity Role",
    "add field label",
    "set field label required",
    "set field label unique",
    "set icon asterisk",
    "create entity Group",
    "add field label",
    "set field label required",
    "set field label unique",
    "set icon users",
    "select entity User",
    "add field Role related to many Role using label",
    "add field Group related to many Group using label",
    "set field Role required",
    "set field Group required",
    "entity Role has many user",
    "entity Group has many user",
    "add entity API credentials",
    "add field Client Name",
    "add field Client Key",
    "add field Client Secret",
    "add field Token",
    "add field Token timeout TMSP",
    "set icon key",
    "add field role related to many Role using label",
    "add field group related to many Group using label",
    "add entity Synchronization",
    "add field Journal backup file",
    "entity Synchronization has one API credentials",
    "add entity Synchro credentials",
    "add field Cloud host with type url",
    "add field Client key",
    "add field Client secret",
    "add widget stat on entity User",
    "add entity Status",
    "set icon tags",
    "add field Entity",
    "add field Field",
    "add field Name",
    "add field Color with type color",
    "add field Accepted group related to many Group using Label",
    "add field Button label",
    "add field Position with type number",
    "add field Default with type boolean",
    "add field Comment with type boolean",
    "entity Status has many Status called Children",
    "entity Status has many Translation called Translations",
    "select entity translation",
    "add field Language",
    "add field Value",
    "create entity Media",
    "set icon envelope",
    "add field Type with type enum and values Mail, Notification, SMS, Task",
    "add field Name",
    "set field Name required",
    "add field Target entity",
    "entity status has many Action called Actions",
    "select entity action",
    "add field Media related to Media using name",
    "add field Order with type number",
    "add field Execution with type enum and values Immédiate, Différée with default value Immédiate",
    "create entity Robot",
    "set icon android",
    "add field Current status with type enum and values CONNECTED, DISCONNECTED, WORKING",
    "add field Name",
    "add field Api credentials related to api credentials using client name",
    "add field Comment with type regular text",
    "create entity Task",
    "set icon cogs",
    "add component status with name State",
    "add field Title",
    "set field Title required",
    "add field Type with type enum and values Manual, Automatic and default value Manual",
    "add field Planned date with type date",
    "add field Execution start date with type date",
    "add field Execution finish date with type date",
    "add field Duration with type decimal",
    "add field Data flow with type regular text",
    "add field Robot related to Robot using Name",
    "add field Program file with type file",
    "add field Procedure with type regular text",
    "add component localfilestorage with name Documents",
    "entity Media has one Media Mail",
    "entity Media has one Media Notification",
    "entity Media has one Media SMS",
    "entity Media has one Media Task",
    "select entity media task",
    "add field Task name",
    "add field Task type with type enum and values Manual, Automatic and default value Manual",
    "add field Assignment logic",
    "add field Program file with type file",
    "add field Data flow with type text",
    "select entity media mail",
    "add field To",
    "add field Cc",
    "add field Cci",
    "add field From",
    "add field Attachments",
    "add field Subject",
    "add field Content with type text",
    "select entity media notification",
    "add field Title",
    "add field Description",
    "add field Icon",
    "add field Color with type color",
    "add field targets",
    "add entity Notification",
    "add field Title",
    "add field Description",
    "add field URL",
    "add field Color with type color",
    "add field Icon",
    "select entity media SMS",
    "add field Message with type text",
    "add field Phone numbers",
    "add entity Inline Help",
    "set icon question-circle-o",
    "add field Entity",
    "add field Field",
    "add field Content with type text",
    "entity user has many notification",
    "entity notification has many user",
    "select module home"
];
let idxAtMandatoryInstructionStart = -1;
function recursiveExecute(req, instructions, idx) {
    return new Promise(function(resolve, reject) {
        // All instructions executed, mandatory instruction included
        if (scriptData[req.session.passport.user.id].totalInstruction == idx){
            function done(){
                var idApplication = scriptData[req.session.passport.user.id].ids.id_application;
                if (idxAtMandatoryInstructionStart != -1 && idx - idxAtMandatoryInstructionStart == mandatoryInstructions.length) {
                    structure_application.initializeApplication(scriptData[req.session.passport.user.id].ids.id_application, req.session.passport.user.id, scriptData[req.session.passport.user.id].name_application).then(function(){
                        // Api documentation
                        docBuilder.build(idApplication);
                        resolve(idApplication);
                    });
                } else {
                    // Api documentation
                    docBuilder.build(idApplication);
                    resolve(idApplication);
                }
            }
            // Set default theme if different than blue-light
            if(typeof req.session.defaultTheme !== "undefined" && req.session.defaultTheme != "blue-light"){
                execute(req, "set theme "+req.session.defaultTheme).then(function() {
                    done();
                });
            } else {
                done();
            }

        } else {
            // If project and application are created and we're at the instruction that
            // follows create application, insert mandatory instructions to instruction array
            if (scriptData[req.session.passport.user.id].ids.id_project > 0 && scriptData[req.session.passport.user.id].ids.id_application > 0 && parser.parse(instructions[idx-1].toLowerCase())["function"] == "createNewApplication") {
                instructions.splice.apply(instructions, [idx, 0].concat(mandatoryInstructions));
                idxAtMandatoryInstructionStart = idx;
            }
            // When all mandatory instructions are executed, initializeApplication then continue recursiveExecute
            if (idxAtMandatoryInstructionStart != -1 && idx - idxAtMandatoryInstructionStart == mandatoryInstructions.length) {
                structure_application.initializeApplication(scriptData[req.session.passport.user.id].ids.id_application, req.session.passport.user.id, scriptData[req.session.passport.user.id].name_application).then(function(){
                    // Write source script in generated workspace
                    var historyPath = __dirname+'/../workspace/'+scriptData[req.session.passport.user.id].ids.id_application+"/history_script.nps";
                    var instructionsToWrite = instructions.slice().splice(mandatoryInstructions.length + 2).join("\n");
                    instructionsToWrite += "\n\n// --- End of the script --- //\n\n";
                    fs.writeFileSync(historyPath, instructionsToWrite);

                    execute(req, instructions[idx]).then(function() {
                        scriptData[req.session.passport.user.id].doneInstruction++;
                        resolve(recursiveExecute(req, instructions, idx + 1));
                    }).catch(function(err) {
                        reject(err);
                    });
                });
            }
            // Nothing specific to do, execute instruction
            else {
                execute(req, instructions[idx]).then(function() {
                    scriptData[req.session.passport.user.id].doneInstruction++;
                    resolve(recursiveExecute(req, instructions, idx + 1));
                }).catch(function(err) {
                    reject(err);
                });
            }
        }
    });
}

// Index
router.get('/index', block_access.isLoggedIn, function(req, res) {

    var data = {
        error: 1,
        profile: req.session.passport.user,
        menu: "script",
        msg: message,
        answers: "",
        instruction: ""
    };

    res.render('front/instruction_script', data);
});

// Execute script file
router.post('/execute', block_access.isLoggedIn, multer({
    dest: './upload/'
}).single('instructions'), function(req, res) {

    var userId = req.session.passport.user.id;
    // Init scriptData object for user. (session simulation)
    scriptData[userId] = {
        over: false,
        answers: [],
        doneInstruction: 0,
        totalInstruction: 0,
        authInstructions: false,
        ids: {
            id_project: -1,
            id_application: -1,
            id_module: -1,
            id_data_entity: -1
        }
    };

    if(scriptProcessing.state && moment().diff(scriptProcessing.timeout, 'seconds') < 100){
        let __ = require("../services/language")(req.session.lang_user).__;
        scriptData[userId].answers = [{
            message: __('instructionScript.alreadyProcessing')
        }];
        scriptData[userId].over = true;
        scriptData[userId].overDueToProcessing = true;
        return res.end();
    }

    // Reset idxAtMandatoryInstructionStart to handle multiple scripts execution
    idxAtMandatoryInstructionStart = -1;

    scriptProcessing.state = true;
    scriptProcessing.timeout = moment();

    // Get file extension
    let extensionFile = req.file.originalname.split(".");
    extensionFile = extensionFile[extensionFile.length -1];
    // Read file to determine encoding
    let fileContent = fs.readFileSync(req.file.path);
    let encoding = require('jschardet').detect(fileContent);
    // If extension or encoding is not supported, send error
    if ((extensionFile != 'txt' && extensionFile != 'nps') || (encoding.encoding.toLowerCase() != 'utf-8' && encoding.encoding.toLowerCase() != 'windows-1252' && encoding.encoding.toLowerCase() != 'ascii')) {
        scriptData[userId].answers.push({
            message: "File need to have .nps or .txt extension and utf8 or ascii encoding.<br>Your file have '"+extensionFile+"' extension and '"+encoding.encoding+"' encoding"
        });
        scriptData[userId].over = true;
        // Delete instructions file
        fs.unlinkSync(req.file.path);
        return res.end();
    }

    // Open file descriptor
    let rl = readline.createInterface({
        input: fs.createReadStream(req.file.path)
    });

    // Read file line by line, check for empty line, line comment, scope comment
    let fileLines = [],
        commenting = false,
        invalidScript = false;

    /* If one of theses value is to 2 after readings all lines then there is an error,
    line to 1 are set because they are mandatory lines added by the generator */
    let exception = {
        createNewProject : {
            value: 0,
            errorMessage: "You can't create or select more than one project in the same script."
        },
        createNewApplication : {
            value: 0,
            errorMessage: "You can't create or select more than one application in the same script."
        },
        createModuleHome: {
            value: 1,
            errorMessage: "You can't create a module home, because it's a default module in the application."
        },
        createModuleAuthentication: {
            value: 1,
            errorMessage: "You can't create a module authentication, because it's a default module in the application."
        },
        createEntityUser: {
            value: 1,
            errorMessage: "You can't create a entity user, because it's a default entity in the application."
        },
        createEntityRole: {
            value: 1,
            errorMessage: "You can't create a entity role, because it's a default entity in the application."
        },
        createEntityGroup: {
            value: 1,
            errorMessage: "You can't create a entity group, because it's a default entity in the application."
        },
        setFieldUnique: {
            value: 1,
            errorMessage: "You can't set a field unique in a script, please execute the instruction in preview."
        },
        delete: {
            value: 1,
            errorMessage: "Please do not use delete instruction in script mode."
        }
    };

    rl.on('line', function(sourceLine) {
        let line = sourceLine;

        // Empty line || One line comment scope
        if (line.trim() == '' || ((line.indexOf('/*') != -1 && line.indexOf('*/') != -1) || line.indexOf('//*') != -1))
            return;
        // Comment scope start
        if (line.indexOf('/*') != -1 && !commenting)
            commenting = true;
        // Comment scope end
        else if (line.indexOf('*/') != -1 && commenting)
            commenting = false;
        else if (!commenting) {
            var positionComment = line.indexOf('//');
            // Line start with comment
            if (positionComment == 0)
                return;
            // Line comment is after or in the instruction
            if (positionComment != -1){
                line = line.substring(0, line.indexOf('//'));
            }
            var parserResult = parser.parse(line);
            // Get the wanted function given by the bot to do some checks
            var designerFunction = parserResult.function;
            var designerValue = null;
            if(typeof parserResult.options !== "undefined")
                designerValue = parserResult.options.value?parserResult.options.value:null;

            if (designerFunction == "createNewProject" || designerFunction == "selectProject")
                exception.createNewProject.value += 1;

            if (designerFunction == "createNewApplication" || designerFunction == "selectApplication"){
                if (designerFunction == "createNewApplication")
                    scriptData[userId].authInstructions = true;
                exception.createNewApplication.value += 1;
            }
            if(designerFunction == "createNewModule" && designerValue.toLowerCase() == "home")
                exception.createModuleHome.value += 1;

            if(designerFunction == "createNewModule" && designerValue.toLowerCase() == "authentication")
                exception.createModuleAuthentication.value += 1;

            if(designerFunction == "createNewEntity" && designerValue.toLowerCase() == "user")
                exception.createEntityUser.value += 1;

            if(designerFunction == "createNewEntity" && designerValue.toLowerCase() == "role")
                exception.createEntityRole.value += 1;

            if(designerFunction == "createNewEntity" && designerValue.toLowerCase() == "group")
                exception.createEntityGroup.value += 1;

            if(typeof designerFunction !== 'undefined' && designerFunction.indexOf('delete') != -1)
                exception.delete.value += 1;

            // if(designerFunction == "setFieldKnownAttribute" && parserResult.options.word.toLowerCase() == "unique")
            //     exception.setFieldUnique.value += 1;

            fileLines.push(line);
        }
    });

    // All lines read, execute instructions
    rl.on('close', function() {
        var isError = false;
        var stringError = "";
        for(var item in exception){
            if(exception[item].value > 1){
                stringError += exception[item].errorMessage + '<br><br>';
                isError = true;
            } else if(item == "createNewProject" && exception[item].value == 0){
                stringError += 'You have to create or select a project in your script.<br><br>';
                isError = true;
            } else if(item == "createNewApplication" && exception[item].value == 0){
                stringError += 'You have to create or select an application in your script.<br><br>';
                isError = true;
            }
        }

        if(isError){
            scriptData[userId].answers = [];
            scriptData[userId].answers.push({
                message: stringError
            });
            scriptData[userId].over = true;
        } else {
            scriptData[userId].totalInstruction = scriptData[userId].authInstructions ? fileLines.length + mandatoryInstructions.length : fileLines.length;
            recursiveExecute(req, fileLines, 0).then(function(idApplication) {
                // Workspace sequelize instance
                delete require.cache[require.resolve(__dirname+ '/../workspace/'+idApplication+'/models/')];
                var workspaceSequelize = require(__dirname +'/../workspace/'+idApplication+'/models/');

                // We need to clear toSync.json
                var toSyncFileName = __dirname + '/../workspace/'+idApplication+'/models/toSync.json';
                var toSyncObject = JSON.parse(fs.readFileSync(toSyncFileName));

                var tableName = "TABLE_NAME";
                if(workspaceSequelize.sequelize.options.dialect == "postgres")
                    tableName = "table_name";
                // Looking for already exisiting table in workspace BDD
                workspaceSequelize.sequelize.query("SELECT * FROM INFORMATION_SCHEMA.TABLES;", {type: workspaceSequelize.sequelize.QueryTypes.SELECT}).then(function(result){
                    var workspaceTables = [];
                    for(var i=0; i<result.length; i++){
                        if(result[i][tableName].substring(0, result[i][tableName].indexOf("_")+1) == idApplication+"_"){
                            workspaceTables.push(result[i][tableName]);
                        }
                    }

                    for(var entity in toSyncObject){
                        if(workspaceTables.indexOf(entity) == -1 && !toSyncObject[entity].force){
                            toSyncObject[entity].attributes = {};
                            // We have to remove options from toSync.json that will be generate with sequelize sync
                            // But we have to keep relation toSync on already existing entities
                            if(typeof toSyncObject[entity].options !== "undefined"){
                                var cleanOptions = [];
                                for(var i=0; i<toSyncObject[entity].options.length; i++){
                                    if(workspaceTables.indexOf(idApplication+"_"+toSyncObject[entity].options[i].target) != -1 && toSyncObject[entity].options[i].relation != "belongsTo")
                                        cleanOptions.push(toSyncObject[entity].options[i]);
                                }
                                toSyncObject[entity].options = cleanOptions;
                            }
                        }
                    }

                    fs.writeFileSync(toSyncFileName, JSON.stringify(toSyncObject, null, 4), 'utf8');

                    // Restart the application server is already running
                    var process_manager = require('../services/process_manager.js');
                    //var process_server = process_manager.process_server;
                    var process_server_per_app = process_manager.process_server_per_app;

                    if (process_server_per_app[idApplication] != null && typeof process_server_per_app[idApplication] !== "undefined") {
                        process_manager.killChildProcess(process_server_per_app[idApplication].pid, function(err) {
                            if(err)
                                console.error(err);

                            // Preparation to start a new child server
                            var math = require('math');
                            var port = math.add(9000, idApplication);
                            var env = Object.create(process.env);
                            env.PORT = port;

                            // Launch server for preview
                            process_server_per_app[idApplication] = process_manager.launchChildProcess(req, idApplication, env);

                            // Finish and redirect to the application
                            scriptData[userId].over = true;
                        });
                    } else {
                        scriptData[userId].over = true;
                    }
                });
            }).catch(function(err) {
                console.error(err);
                scriptData[userId].over = true;
            });
        }

        // Delete instructions file
        fs.unlinkSync(req.file.path);
    });

    res.end();
});

/* Execute when it's not a file upload but a file written in textarea */
router.post('/execute_alt', block_access.isLoggedIn, function(req, res) {

    let userId = req.session.passport.user.id;
    let __ = require("../services/language")(req.session.lang_user).__;

    // Init scriptData object for user. (session simulation)
    scriptData[userId] = {
        over: false,
        answers: [],
        doneInstruction: 0,
        totalInstruction: 0,
        authInstructions: false,
        ids: {
            id_project: -1,
            id_application: -1,
            id_module: -1,
            id_data_entity: -1
        }
    };

    // Processing already occured less than the last 100 seconds
    if(scriptProcessing.state && moment().diff(scriptProcessing.timeout, 'seconds') < 100){
        scriptData[userId].answers = [{
            message: __('instructionScript.alreadyProcessing')
        }];
        scriptData[userId].over = true;
        scriptData[userId].overDueToProcessing = true;
        return res.end();
    }

    // Reset idxAtMandatoryInstructionStart to handle multiple scripts execution
    idxAtMandatoryInstructionStart = -1;

    scriptProcessing.state = true;
    scriptProcessing.timeout = moment();

    let tmpFilename = moment().format('YY-MM-DD-HH_mm_ss')+"_custom_script.txt";
    let tmpPath = __dirname+'/../upload/'+tmpFilename;

    // Load template script and unzip master file if application is created using template
    let templateEntry = req.body.template_entry;
    let template = {};

    fs.openSync(tmpPath, 'w');

    if(templateEntry){
        let templateLang;
        switch(req.session.lang_user.toLowerCase()) {
            case "fr-fr":
                templateLang = "fr";
                break;
            case "en-en":
                templateLang = "en";
                break;
            default:
                templateLang = "fr";
                break;
        }

        let files = fs.readdirSync(__dirname + "/../templates/"+templateEntry);
        let filename = false;

        for (let i = 0; i < files.length; i++) {
            if (files[i].indexOf(".nps") != -1) {
                if(!filename)
                    filename = path.join(__dirname + "/../templates/"+templateEntry, files[i]);
                else if(files[i].indexOf("_"+templateLang+"_") != -1)
                    filename = path.join(__dirname + "/../templates/"+templateEntry, files[i]);
            }
        }

        if(!filename){
            scriptData[userId].answers = [{
                message: __('template.no_script')
            }];
            scriptData[userId].over = true;
            scriptProcessing.state = false;
            return res.end();
        }

        // Write template script in the tmpPath
        fs.writeFileSync(tmpPath, fs.readFileSync(filename));

    } else {
        fs.writeFileSync(tmpPath, req.body.text);
    }

    // Open file descriptor
    var rl = readline.createInterface({
        input: fs.createReadStream(tmpPath)
    });

    // Read file line by line, check for empty line, line comment, scope comment
    var fileLines = [],
        commenting = false,
        invalidScript = false;

    /* If one of theses value is to 2 after readings all lines then there is an error,
    line to 1 are set because they are mandatory lines added by the generator */
    var exception = {
        createNewProject : {
            value: 0,
            errorMessage: "You can't create or select more than one project in the same script."
        },
        createNewApplication : {
            value: 0,
            errorMessage: "You can't create or select more than one application in the same script."
        },
        createModuleHome: {
            value: 1,
            errorMessage: "You can't create a module home, because it's a default module in the application."
        },
        createModuleAuthentication: {
            value: 1,
            errorMessage: "You can't create a module authentication, because it's a default module in the application."
        },
        createEntityUser: {
            value: 1,
            errorMessage: "You can't create a entity user, because it's a default entity in the application."
        },
        createEntityRole: {
            value: 1,
            errorMessage: "You can't create a entity role, because it's a default entity in the application."
        },
        createEntityGroup: {
            value: 1,
            errorMessage: "You can't create a entity group, because it's a default entity in the application."
        },
        setFieldUnique: {
            value: 1,
            errorMessage: "You can't set a field unique in a script, please execute the instruction in preview."
        },
        delete: {
            value: 1,
            errorMessage: "Please do not use delete instruction in script mode."
        }
    };

    rl.on('line', function(sourceLine) {
        var line = sourceLine;

        // Empty line || One line comment scope
        if (line.trim() == '' || ((line.indexOf('/*') != -1 && line.indexOf('*/') != -1) || line.indexOf('//*') != -1))
            return;
        // Comment scope start
        if (line.indexOf('/*') != -1 && !commenting)
            commenting = true;
        // Comment scope end
        else if (line.indexOf('*/') != -1 && commenting)
            commenting = false;
        else if (!commenting) {
            var positionComment = line.indexOf('//');
            // Line start with comment
            if (positionComment == 0)
                return;
            // Line comment is after or in the instruction
            if (positionComment != -1){
                line = line.substring(0, line.indexOf('//'));
            }
            var parserResult = parser.parse(line);
            // Get the wanted function given by the bot to do some checks
            var designerFunction = parserResult.function;
            var designerValue = null;
            if(typeof parserResult.options !== "undefined")
                designerValue = parserResult.options.value?parserResult.options.value:null;
            if (designerFunction == "createNewProject" || designerFunction == "selectProject")
                exception.createNewProject.value += 1;
            if (designerFunction == "createNewApplication" || designerFunction == "selectApplication"){
                if (designerFunction == "createNewApplication")
                    scriptData[userId].authInstructions = true;
                exception.createNewApplication.value += 1;
            }
            if(designerFunction == "createNewModule" && designerValue.toLowerCase() == "home")
                exception.createModuleHome.value += 1;

            if(designerFunction == "createNewModule" && designerValue.toLowerCase() == "authentication")
                exception.createModuleAuthentication.value += 1;

            if(designerFunction == "createNewEntity" && designerValue.toLowerCase() == "user")
                exception.createEntityUser.value += 1;

            if(designerFunction == "createNewEntity" && designerValue.toLowerCase() == "role")
                exception.createEntityRole.value += 1;

            if(designerFunction == "createNewEntity" && designerValue.toLowerCase() == "group")
                exception.createEntityGroup.value += 1;

            if(typeof designerFunction !== 'undefined' && designerFunction.indexOf('delete') != -1)
                exception.delete.value += 1;

            // if(designerFunction == "setFieldKnownAttribute" && parserResult.options.word.toLowerCase() == "unique")
            //     exception.setFieldUnique.value += 1;

            fileLines.push(line);
        }
    });

    // All lines read, execute instructions
    rl.on('close', function() {
        var isError = false;
        var stringError = "";
        for(var item in exception){
            if(exception[item].value > 1){
                stringError += exception[item].errorMessage + '<br><br>';
                isError = true;
            } else if(item == "createNewProject" && exception[item].value == 0){
                stringError += 'You have to create or select a project in your script.<br><br>';
                isError = true;
            } else if(item == "createNewApplication" && exception[item].value == 0){
                stringError += 'You have to create or select an application in your script.<br><br>';
                isError = true;
            }
        }

        if(isError){
            scriptData[userId].answers = [];
            scriptData[userId].answers.push({
                message: stringError
            });
            scriptData[userId].over = true;
        } else{
            scriptData[userId].totalInstruction = scriptData[userId].authInstructions ? fileLines.length + mandatoryInstructions.length : fileLines.length;
            recursiveExecute(req, fileLines, 0).then(function(idApplication) {
                // Workspace sequelize instance
                delete require.cache[require.resolve(__dirname+ '/../workspace/'+idApplication+'/models/')];
                var workspaceSequelize = require(__dirname +'/../workspace/'+idApplication+'/models/');

                // We need to clear toSync.json
                var toSyncFileName = __dirname + '/../workspace/'+idApplication+'/models/toSync.json';
                var toSyncObject = JSON.parse(fs.readFileSync(toSyncFileName));

                var tableName = "TABLE_NAME";
                if(workspaceSequelize.sequelize.options.dialect == "postgres")
                    tableName = "table_name";
                // Looking for already exisiting table in workspace BDD
                workspaceSequelize.sequelize.query("SELECT * FROM INFORMATION_SCHEMA.TABLES;", {type: workspaceSequelize.sequelize.QueryTypes.SELECT}).then(function(result){
                    var workspaceTables = [];
                    for(var i=0; i<result.length; i++){
                        if(result[i][tableName].substring(0, result[i][tableName].indexOf("_")+1) == idApplication+"_"){
                            workspaceTables.push(result[i][tableName]);
                        }
                    }

                    for(var entity in toSyncObject){
                        if(workspaceTables.indexOf(entity) == -1 && !toSyncObject[entity].force){
                            toSyncObject[entity].attributes = {};
                            // We have to remove options from toSync.json that will be generate with sequelize sync
                            // But we have to keep relation toSync on already existing entities
                            if(typeof toSyncObject[entity].options !== "undefined"){
                                var cleanOptions = [];
                                for(var i=0; i<toSyncObject[entity].options.length; i++){
                                    if(workspaceTables.indexOf(idApplication+"_"+toSyncObject[entity].options[i].target) != -1 && toSyncObject[entity].options[i].relation != "belongsTo")
                                        cleanOptions.push(toSyncObject[entity].options[i]);
                                }
                                toSyncObject[entity].options = cleanOptions;
                            }
                        }
                    }

                    // If there is data to add in template
                    if (templateEntry && fs.existsSync(__dirname + '/../templates/' + templateEntry + "/data.json")){
                        let dataSqlContent = JSON.parse(fs.readFileSync(__dirname + '/../templates/' + templateEntry + "/data.json", "utf8"), null, 4);
                        if(dataSqlContent.length != 0 && !toSyncObject.queries)
                            toSyncObject.queries = [];
                        for (let i = 0; i < dataSqlContent.length; i++) {
                            for (let j = 0; j < dataSqlContent[i].queries.length; j++) {
                                toSyncObject.queries.push(dataSqlContent[i].queries[j].replace(dataSqlContent[i].table, idApplication+"_"+dataSqlContent[i].table))
                            }
                        }
                    }

                    fs.writeFileSync(toSyncFileName, JSON.stringify(toSyncObject, null, 4), 'utf8');

                    // Copy choosen template in generated workspace
                    if (templateEntry) {
                        fs.copySync(__dirname + '/../templates/' + templateEntry, __dirname + '/../workspace/' + idApplication);
                    }

                    // Restart the application server is already running
                    var process_manager = require('../services/process_manager.js');
                    //var process_server = process_manager.process_server;
                    var process_server_per_app = process_manager.process_server_per_app;


                    if (process_server_per_app[idApplication] != null && typeof process_server_per_app[idApplication] !== "undefined") {
                        process_manager.killChildProcess(process_server_per_app[idApplication].pid, function(err) {
                            if(err)
                                console.error(err);

                            // Preparation to start a new child server
                            var math = require('math');
                            var port = math.add(9000, idApplication);
                            var env = Object.create(process.env);
                            env.PORT = port;

                            // Launch server for preview
                            process_server_per_app[idApplication] = process_manager.launchChildProcess(req, idApplication, env);

                            // Finish and redirect to the application
                            scriptData[userId].over = true;
                        });
                    } else {
                        scriptData[userId].over = true;
                    }
                }).catch(function(err) {
                    console.error(err);
                });
            }).catch(function(err) {
                console.error(err);
                scriptData[userId].over = true;
            });
        }

        // Delete instructions file
        fs.unlinkSync(tmpPath);
    });

    res.end();
});

// Script execution status
router.get('/status', (req, res) => {
    try {
        let userId = req.session.passport.user.id;
        let stats = {
            totalInstruction: scriptData[userId].totalInstruction,
            doneInstruction: scriptData[userId].doneInstruction,
            over: scriptData[userId].over,
            text: scriptData[userId].answers
        };
        scriptData[userId].answers = [];

        // Script over, remove data from array
        if (stats.over) {
            stats.id_application = scriptData[userId].ids.id_application;
            req.session.id_application = scriptData[userId].ids.id_application;
            req.session.id_project = scriptData[userId].ids.id_project;
            req.session.id_data_entity = scriptData[userId].ids.id_data_entity;
            req.session.id_module = scriptData[userId].ids.id_module;
            if(typeof scriptData[userId].overDueToProcessing === 'undefined')
                scriptProcessing.state = false;
            delete scriptData[userId];
        }

        res.send(stats).end();
    } catch(err) {
        res.send({
            skip: true
        }).end();
    }
});

module.exports = router;