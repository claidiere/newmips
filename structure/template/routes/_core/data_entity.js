const express = require('express');
const router = express.Router();
const block_access = require('../utils/block_access');
// Datalist
const filterDataTable = require('../utils/filter_datatable');

// Sequelize
const models = require('../models/');
const model_builder = require('../utils/model_builder');
const entity_helper = require('../utils/entity_helper');
const file_helper = require('../utils/file_helper');
const status_helper = require('../utils/status_helper');
const component_helper = require('../utils/component_helper');
const globalConfig = require('../config/global');
const fs = require('fs-extra');
const dust = require('dustjs-linkedin');
const moment = require("moment");
const SELECT_PAGE_SIZE = 10;

// Enum and radio managment
const enums_radios = require('../utils/enum_radio.js');

// Winston logger
const logger = require('../utils/logger');

class DataEntity {

    constructor(entityName, additionnalRoutes = []) {
        this.entityName = entityName;
        this.modelName = entity_helper.capitalizeFirstLetter(entityName);
        this.options = require('../models/options/'+entityName);
        this.attributes = require('../models/attributes/'+entityName);

        this.router = express.Router();
        this.registeredRoutes = [
            'list',
            'datalist',
            'subdatalist',
            'show',
            'create_form',
            'create',
            'update_form',
            'update',
            'loadtab',
            'set_status',
            'search',
            'fieldset_remove',
            'fieldset_add',
            'destroy',
            ...additionnalRoutes
        ];
    }

    get routes() {
        for (const route of this.registeredRoutes)
            this[route]();

        return this.router;
    }

    asyncRoute(fn) {
        return (...args) => {
            const fnReturn = fn(...args)
            const req = args[0], res = args[1], next = args[args.length - 1]
            return Promise.resolve(fnReturn)
            .catch(err => {
                entity_helper.error(err, req, res, req.baseUrl, "e_"+ req.originalUrl.split("/"));
            });
        }
    }


    //
    // Routes
    //

    list() {
        this.router.post('/list', this.middlewares.list, this.asyncRoute(async (req, res) => {
            data = await this.hooks.list.beforeRender();
            res.render(renderFile, data);
        }));
    }

    datalist() {
        this.router.post('/datalist', this.middlewares.datalist, this.asyncRoute(async (req, res) => {
            await this.hooks.datalist.beforeDBQuery();

            let rawData = await filterDataTable("MODEL_NAME", dataTouse);
            let preparedData = await entity_helper.prepareDatalistResult(this.entityName, rawData, req.session.lang_user)

            await this.hooks.datalist.afterDBQuery();

            res.send(preparedData).end();
        }));
    }

    subdatalist() {
        this.router.post('/subdatalist', this.middlewares.subdatalist, this.asyncRoute(async (req, res) => {
            let start = parseInt(req.body.start || 0);
            let length = parseInt(req.body.length || 10);

            let sourceId = req.query.sourceId;
            let subentityAlias = req.query.subentityAlias, subentityName = req.query.subentityModel;
            let subentityModel = entity_helper.capitalizeFirstLetter(req.query.subentityModel);
            let doPagination = req.query.paginate;

            // Build array of fields for include and search object
            let isGlobalSearch = req.body.search.value == "" ? false : true;
            let search = {}, searchTerm = isGlobalSearch ? '$or' : '$and';
            search[searchTerm] = [];
            let toInclude = [];
            // Loop over columns array
            for (let i = 0, columns = req.body.columns; i < columns.length; i++) {
                if (columns[i].searchable == 'false')
                    continue;

                // Push column's field into toInclude. toInclude will be used to build the sequelize include. Ex: toInclude = ['r_alias.r_other_alias.f_field', 'f_name']
                toInclude.push(columns[i].data);

                // Add column own search
                if (columns[i].search.value != "") {
                    let {type, value} = JSON.parse(columns[i].search.value);
                    search[searchTerm].push(model_builder.formatSearch(columns[i].data, value, type));
                }
                // Add column global search
                if (isGlobalSearch)
                    search[searchTerm].push(model_builder.formatSearch(columns[i].data, req.body.search.value, req.body.columnsTypes[columns[i].data]));
            }
            for (let i = 0; i < req.body.columns.length; i++)
                if (req.body.columns[i].searchable == 'true')
                    toInclude.push(req.body.columns[i].data);
            // Get sequelize include object
            let subentityInclude = model_builder.getIncludeFromFields(models, subentityName, toInclude);

            // ORDER BY
            let order, stringOrder = req.body.columns[req.body.order[0].column].data;
            // If ordering on an association field, use Sequelize.literal so it can match field path 'r_alias.f_name'
            order = stringOrder.indexOf('.') != -1 ? [[models.Sequelize.literal(stringOrder), req.body.order[0].dir]] : [[stringOrder, req.body.order[0].dir]];

            let include = {
                model: models[subentityModel],
                as: subentityAlias,
                order: order,
                include: subentityInclude
            }
            if (search[searchTerm].length > 0)
                include.where = search;

            if (search[searchTerm].length > 0)
                include.where = search;

            if (doPagination == "true") {
                include.limit = length;
                include.offset = start;
            }

            include.required = false;

            include = await this.hooks.subdatalist.defineInclude(include);

            await this.hooks.subdatalist.beforeDBQuery();

            const entity = await models[this.modelName].findOne({
                where: {
                    id: parseInt(sourceId)
                },
                include: include
            });

            await this.hooks.subdatalist.afterDBQuery();

            if (!entity['count' + entity_helper.capitalizeFirstLetter(subentityAlias)]) {
                console.error('/subdatalist: count' + entity_helper.capitalizeFirstLetter(subentityAlias) + ' is undefined');
                return res.status(500).end();
            }

            const count = await entity['count' + entity_helper.capitalizeFirstLetter(subentityAlias)]();
            let rawData = {
                recordsTotal: count,
                recordsFiltered: count,
                data: []
            };
            for (let i = 0; i < entity[subentityAlias].length; i++)
                rawData.data.push(entity[subentityAlias][i].get({plain: true}));

            const preparedData = await entity_helper.prepareDatalistResult(req.query.subentityModel, rawData, req.session.lang_user)

            await this.hooks.subdatalist.beforeRender();

            res.send(preparedData).end();
        }));
    }

    show() {
        this.router.get('/show', this.middlewares.show, this.asyncRoute(async (req, res) => {
            let id_entity = req.query.id;
            let tab = req.query.tab;
            let data = {
                tab: tab,
                // If we arrive from an associated tab, hide the create and the list button
                hideButton: typeof req.query.hideButton !== 'undefined' ? req.query.hideButton : undefined,
                enum_radio: enums_radios.translated(this.entityName, req.session.lang_user, options)
            };

            await this.hooks.show.beforeDBQuery();

            const entity = await entity_helper.optimizedFindOne(this.modelName, id_entity, options)
            if (!entity) {
                data.error = 404;
                logger.debug("No data entity found.");
                return res.render('common/error', data);
            }

            await this.hooks.show.afterDBQuery();

            /* Update local entity data before show */
            data[entityName] = entity;
            // Update some data before show, e.g get picture binary
            await entity_helper.getPicturesBuffers(entity, this.entityName);

            status_helper.translate(entity, attributes, req.session.lang_user);
            data.componentAddressConfig = component_helper.getMapsConfigIfComponentAddressExist(this.entityName);
            // Get association data that needed to be load directly here (to do so set loadOnStart param to true in options).
            data = await entity_helper.getLoadOnStartData(data, options)

            await this.hooks.show.beforeRender();

            res.render(this.entityName+'/show', data);
        }));
    }

    create_form() {
        this.router.get('/create_form', this.middlewares.create_form, this.asyncRoute(async (req, res) => {
            let data = {
                enum_radio: enums_radios.translated(this.entityName, req.session.lang_user, options)
            };

            if (typeof req.query.associationFlag !== 'undefined') {
                data.associationFlag = req.query.associationFlag;
                data.associationSource = req.query.associationSource;
                data.associationForeignKey = req.query.associationForeignKey;
                data.associationAlias = req.query.associationAlias;
                data.associationUrl = req.query.associationUrl;
            }

            await this.hooks.create_form.beforeDataLoad();

            // Get association data that needed to be load directly here (to do so set loadOnStart param to true in options).
            data = await entity_helper.getLoadOnStartData(data, options);
            let view = req.query.ajax ? this.entityName+'/create_fields' : this.entityName+'/create';

            await this.hooks.create_form.beforeRender()

            res.render(view, data);
        }));
    }

    create() {
        this.router.post('/create', this.middlewares.create, this.asyncRoute(async (req, res) => {

            await this.hooks.create.beforeBodyParse()

            let createObject = model_builder.buildForRoute(attributes, options, req.body);

            await this.hooks.create.beforeEntityCreate()

            let entity = await models[this.modelName].create(createObject);
            let redirect = '/ENTITY_URL_NAME/show?id=' + entity.id;
            req.session.toastr = [{
                message: 'message.create.success',
                level: "success"
            }];

            await this.hooks.create.afterEntityCreate();

            let promises = [];

            if (typeof req.body.associationFlag !== 'undefined') {
                redirect = '/' + req.body.associationUrl + '/show?id=' + req.body.associationFlag + '#' + req.body.associationAlias;
                promises.push(new Promise(function(resolve, reject) {
                    models[entity_helper.capitalizeFirstLetter(req.body.associationSource)].findOne({
                        where: {
                            id: req.body.associationFlag
                        }
                    }).then(function(association) {
                        if (!association) {
                            entity.destroy();
                            let err = new Error();
                            err.message = "Association not found.";
                            reject(err);
                        }

                        let modelName = req.body.associationAlias.charAt(0).toUpperCase() + req.body.associationAlias.slice(1).toLowerCase();
                        if (typeof association['add' + modelName] !== 'undefined') {
                            association['add' + modelName](entity.id).then(resolve).catch(function(err) {
                                reject(err);
                            });
                        } else {
                            let obj = {};
                            obj[req.body.associationForeignKey] = entity.id;
                            association.update(obj).then(resolve).catch(function(err) {
                                reject(err);
                            });
                        }
                    });
                }));
            }

            // We have to find value in req.body that are linked to an hasMany or belongsToMany association
            // because those values are not updated for now
            promises.push(model_builder.setAssocationManyValues(entity, req.body, createObject, options));
            promises.push(component_helper.setAddressIfComponentExist(entity, options, req.body));

            await Promise.all(promises);

            await this.hooks.create.beforeRender();

            res.redirect(redirect);
        }));
    }

    update_form() {
        this.router.get('/update_form', this.middlewares.update_form, this.asyncRoute(async (req, res) => {
            let id_entity = req.query.id;
            let data = {
                enum_radio: enums_radios.translated(this.entityName, req.session.lang_user, options)
            };

            if (typeof req.query.associationFlag !== 'undefined') {
                data.associationFlag = req.query.associationFlag;
                data.associationSource = req.query.associationSource;
                data.associationForeignKey = req.query.associationForeignKey;
                data.associationAlias = req.query.associationAlias;
                data.associationUrl = req.query.associationUrl;
            }

            await this.hooks.update_form.beforeDataLoad();

            let entity = await entity_helper.optimizedFindOne(this.modelName, id_entity, options);
            if (!entity) {
                data.error = 404;
                return res.render('common/error', data);
            }

            entity.dataValues.enum_radio = data.enum_radio;
            data.entity = entity;
            // Update some data before show, e.g get picture binary
            await entity_helper.getPicturesBuffers(entity, this.entityName, true)
            // Get association data that needed to be load directly here (to do so set loadOnStart param to true in options).
            data = await entity_helper.getLoadOnStartData(req.query.ajax ? entity.dataValues : data, options);

            await this.hooks.update_form.beforeRender();

            if (req.query.ajax) {
                entity.dataValues = data;
                res.render(this.entityName+'/update_fields', entity.get({
                    plain: true
                }));
            } else
                res.render(this.entityName+'/update', data);
        }));
    }

    update() {
        this.router.post('/update', this.middlewares.update, this.asyncRoute(async (req, res) => {
            let id_entity = parseInt(req.body.id);

            await this.hooks.update.beforeBodyParse();

            if (typeof req.body.version !== "undefined" && req.body.version != null && !isNaN(req.body.version) && req.body.version != '')
                req.body.version = parseInt(req.body.version) + 1;
            else
                req.body.version = 0;

            let updateObject = model_builder.buildForRoute(attributes, options, req.body);

            await this.hooks.update.afterBodyParse();

            let entity = models[this.modelName].findOne({
                where: {
                    id: id_entity
                }
            });

            if (!entity) {
                data.error = 404;
                logger.debug("Not found - Update");
                return res.render('common/error', data);
            }
            await component_helper.updateAddressIfComponentExist(entity, options, req.body);

            await this.hooks.update.beforeEntityUpdate();

            await entity.update(updateObject)

            await this.hooks.update.afterEntityUpdate();

            // We have to find value in req.body that are linked to an hasMany or belongsToMany association
            // because those values are not updated for now
            await model_builder.setAssocationManyValues(entity, req.body, updateObject, options)

            let redirect = '/ENTITY_URL_NAME/show?id=' + id_entity;
            if (typeof req.body.associationFlag !== 'undefined')
                redirect = '/' + req.body.associationUrl + '/show?id=' + req.body.associationFlag + '#' + req.body.associationAlias;

            req.session.toastr = [{
                message: 'message.update.success',
                level: "success"
            }];

            await this.hooks.update.beforeRender();

            res.redirect(redirect);
        }));
    }

    loadtab() {
        this.router.get('/loadtab/:id/:alias', this.middlewares.loadtab, this.asyncRoute(async (req, res) => {
            let alias = req.params.alias;
            let id = req.params.id;

            // Find tab option
            let option;
            for (let i = 0; i < options.length; i++)
                if (options[i].as == req.params.alias) {
                    option = options[i];
                    break;
                }
            if (!option)
                return res.status(404).end();

            // Check access rights to subentity
            if (!block_access.entityAccess(req.session.passport.user.r_group, option.target.substring(2)))
                return res.status(403).end();

            let queryOpts = {
                where: {
                    id: id
                }
            };
            // If hasMany, no need to include anything since it will be fetched using /subdatalist
            if (option.structureType != 'hasMany')
                queryOpts.include = {
                    model: models[entity_helper.capitalizeFirstLetter(option.target)],
                    as: option.as,
                    include: {
                        all: true
                    }
                }

            await this.hooks.loadtab.beforeDBQuery();

            // Fetch tab data
            let entity = await models[this.modelName].findOne(queryOpts);
            if (!entity)
                return res.status(404).end();

            await this.hooks.loadtab.afterDBQuery();

            let dustData = entity[option.as] || null;
            let empty = !dustData || (dustData instanceof Array && dustData.length == 0) ? true : false;
            let dustFile, idSubentity, promisesData = [];
            let subentityOptions = [];

            // Default value
            option.noCreateBtn = false;

            await this.hooks.loadtab.beforeTabTypeSelection();

            // Build tab specific variables
            switch (option.structureType) {
                case 'hasOne':
                    if (!empty) {
                        idSubentity = dustData.id;
                        dustData.hideTab = true;
                        dustData.enum_radio = enums_radios.translated(option.target, req.session.lang_user, options);
                        promisesData.push(entity_helper.getPicturesBuffers(dustData, option.target));
                        // Fetch status children to be able to switch status
                        // Apply getR_children() on each current status
                        let subentityOptions = require('../models/options/' + option.target);
                        dustData.componentAddressConfig = component_helper.getMapsConfigIfComponentAddressExist(option.target);
                        for (let i = 0; i < subentityOptions.length; i++)
                            if (subentityOptions[i].target.indexOf('e_status') == 0)
                                (function(alias) {
                                    promisesData.push(new Promise(function(resolve, reject) {
                                        dustData[alias].getR_children().then(function(children) {
                                            dustData[alias].r_children = children;
                                            resolve();
                                        });
                                    }));
                                })(subentityOptions[i].as);
                    }
                    dustFile = option.target + '/show_fields';
                    break;

                case 'hasMany':
                    dustFile = option.target + '/list_fields';
                    // Status history specific behavior. Replace history_model by history_table to open view
                    if (option.target.indexOf('e_history_e_') == 0)
                        option.noCreateBtn = true;
                    dustData = {
                        for: 'hasMany'
                    };
                    if (typeof req.query.associationFlag !== 'undefined') {
                        dustData.associationFlag = req.query.associationFlag;
                        dustData.associationSource = req.query.associationSource;
                        dustData.associationForeignKey = req.query.associationForeignKey;
                        dustData.associationAlias = req.query.associationAlias;
                        dustData.associationUrl = req.query.associationUrl;
                    }
                    break;

                case 'hasManyPreset':
                    dustFile = option.target + '/list_fields';
                    let obj = {};
                    obj[option.target] = dustData;
                    dustData = obj;
                    if (typeof req.query.associationFlag !== 'undefined') {
                        dustData.associationFlag = req.query.associationFlag;
                        dustData.associationSource = req.query.associationSource;
                        dustData.associationForeignKey = req.query.associationForeignKey;
                        dustData.associationAlias = req.query.associationAlias;
                        dustData.associationUrl = req.query.associationUrl;
                    }
                    dustData.for = 'fieldset';
                    for (let i = 0; i < dustData[option.target].length; i++)
                        promisesData.push(entity_helper.getPicturesBuffers(dustData[option.target][i], option.target, true));

                    break;

                case 'localfilestorage':
                    dustFile = option.target + '/list_fields';
                    let obj = {};
                    obj[option.target] = dustData;
                    dustData = obj;
                    dustData.sourceId = id;
                    break;

                default:
                    return res.status(500).end();
            }

            // Get association data that needed to be load directly here (to do so set loadOnStart param to true in options).
            let dustData = entity_helper.getLoadOnStartData(dustData, subentityOptions)

            await this.hooks.loadtab.afterTabTypeSelection();

            await Promise.all(promisesData);

            await this.hooks.loadtab.promisesArrayResolved();

            // Open and render dust file
            let file = fs.readFileSync(__dirname + '/../views/' + dustFile + '.dust', 'utf8');
            dust.insertLocalsFn(dustData ? dustData : {}, req);
            let rendered = await new Promise((resolve, reject) => {
                dust.renderSource(file, dustData || {}, function(err, rendered) {
                    if (err) {
                        console.error(err);
                        return reject();
                    }

                    // Send response to ajax request
                    resolve(rendered)
                });
            });

            await this.hooks.loadtab.beforeRender();

            res.json({
                content: rendered,
                data: idSubentity || {},
                empty: empty,
                option: option
            });
        }));
    }

    set_status() {
        this.router.get('/set_status/:id_ENTITY_URL_NAME/:status/:id_new_status', this.middlewares.set_status, block_access.statusGroupAccess, this.asyncRoute(async (req, res) => {

            await this.hooks.set_status.beforeStatusChange();

            await status_helper.setStatus(this.entityName, req.params.id_ENTITY_URL_NAME, req.params.status, req.params.id_new_status, req.session.passport.user.id, req.query.comment)

            await this.hooks.set_status.afterStatusChange();

            res.redirect(req.headers.referer);
        }));
    }

    search() {
        this.router.post('/search', this.middlewares.search, this.asyncRoute(async (req, res) => {
            let search = '%' + (req.body.search || '') + '%';
            let limit = SELECT_PAGE_SIZE;
            let offset = (req.body.page - 1) * limit;

            // ID is always needed
            if (req.body.searchField.indexOf("id") == -1)
                req.body.searchField.push('id');

            let where = {
                raw: true,
                attributes: req.body.searchField,
                where: {}
            };
            if (search != '%%') {
                if (req.body.searchField.length == 1) {
                    where.where[req.body.searchField[0]] = {
                        $like: search
                    };
                } else {
                    where.where.$or = [];
                    for (let i = 0; i < req.body.searchField.length; i++) {
                        if (req.body.searchField[i] != "id") {
                            let currentOrObj = {};
                            if(req.body.searchField[i].indexOf(".") != -1){
                                currentOrObj["$"+req.body.searchField[i]+"$"] = {
                                    $like: search
                                }
                            } else {
                                currentOrObj[req.body.searchField[i]] = {
                                    $like: search
                                }
                            }
                            where.where.$or.push(currentOrObj);
                        }
                    }
                }
            }

            // Example custom where in select HTML attributes, please respect " and ':
            // data-customwhere='{"myField": "myValue"}'

            // Notice that customwhere feature do not work with related to many field if the field is a foreignKey !

            // Possibility to add custom where in select2 ajax instanciation
            if (typeof req.body.customwhere !== "undefined"){
                // If customwhere from select HTML attribute, we need to parse to object
                if(typeof req.body.customwhere === "string")
                    req.body.customwhere = JSON.parse(req.body.customwhere);
                for (let param in req.body.customwhere) {
                    // If the custom where is on a foreign key
                    if (param.indexOf("fk_") != -1) {
                        for (let option in options) {
                            // We only add where condition on key that are standard hasMany relation, not belongsToMany association
                            if ((options[option].foreignKey == param || options[option].otherKey == param) && options[option].relation != "belongsToMany"){
                                // Where on include managment if fk
                                if(param.indexOf(".") != -1){
                                    where.where["$"+param+"$"] = req.body.customwhere[param];
                                } else {
                                    where.where[param] = req.body.customwhere[param];
                                }
                            }
                        }
                    } else {
                        if(param.indexOf(".") != -1){
                            where.where["$"+param+"$"] = req.body.customwhere[param];
                        } else {
                            where.where[param] = req.body.customwhere[param];
                        }
                    }
                }
            }

            where.offset = offset;
            where.limit = limit;

            // If you need to show fields in the select that are in an other associate entity
            // You have to include those entity here
            // where.include = [{model: models.E_myentity, as: "r_myentity"}]

            await this.hooks.search.beforeDBQuery();

            let results = await models[this.modelName].findAndCountAll(where);

            results.more = results.count > req.body.page * SELECT_PAGE_SIZE ? true : false;
            // Format value like date / datetime / etc...
            for (let field in attributes)
                for (let i = 0; i < results.rows.length; i++)
                    for (let fieldSelect in results.rows[i])
                        if(fieldSelect == field)
                            switch(attributes[field].newmipsType) {
                                case "date":
                                    if(results.rows[i][fieldSelect] && results.rows[i][fieldSelect] != "")
                                        results.rows[i][fieldSelect] = moment(results.rows[i][fieldSelect]).format(req.session.lang_user == "fr-FR" ? "DD/MM/YYYY" : "YYYY-MM-DD")
                                    break;
                                case "datetime":
                                    if(results.rows[i][fieldSelect] && results.rows[i][fieldSelect] != "")
                                        results.rows[i][fieldSelect] = moment(results.rows[i][fieldSelect]).format(req.session.lang_user == "fr-FR" ? "DD/MM/YYYY HH:mm" : "YYYY-MM-DD HH:mm")
                                    break;
                            }

            await this.hooks.search.afterDBQuery();

            res.json(results);
        }));
    }

    fieldset_remove() {
        this.router.post('/fieldset/:alias/remove', this.middlewares.fieldset_remove, this.asyncRoute(async (req, res) => {
            let alias = req.params.alias;
            let idToRemove = req.body.idRemove;
            let idEntity = req.body.idEntity;

            let entity = await models[this.modelName].findOne({
                where: {id: idEntity}
            });
            if (!entity) {
                let data = {
                    error: 404
                };
                return res.render('common/error', data);
            }

            // Get all associations
            await entity['remove' + entity_helper.capitalizeFirstLetter(alias)](idToRemove)

            await this.hooks.fieldset_remove.afterRemove();

            res.sendStatus(200).end();
        }));
    }

    fieldset_add() {
        this.router.post('/fieldset/:alias/add', this.middlewares.fieldset_add, this.asyncRoute(async (req, res) => {
            let alias = req.params.alias;
            let idEntity = req.body.idEntity;
            let entity = await models[this.modelName].findOne({
                where: {id: idEntity}
            });
            if (!entity) {
                let data = {
                    error: 404
                };
                logger.debug("No data entity found.");
                return res.render('common/error', data);
            }

            let toAdd;
            if (typeof(toAdd = req.body.ids) === 'undefined') {
                req.session.toastr.push({
                    message: 'message.create.failure',
                    level: "error"
                });
                return res.redirect('/ENTITY_URL_NAME/show?id=' + idEntity + "#" + alias);
            }

            await entity['add' + entity_helper.capitalizeFirstLetter(alias)](toAdd)

            await this.hooks.fieldset_add.afterAdd();

            res.redirect('/ENTITY_URL_NAME/show?id=' + idEntity + "#" + alias);
        }));
    }

    destroy() {
        this.router.post('/delete', this.middlewares.destroy, this.asyncRoute(async (req, res) => {
            let id_entity = parseInt(req.body.id);

            let deleteObject = await models[this.modelName].findOne({
                where: {id: id_entity}
            })

            if (!deleteObject) {
                let data = {
                    error: 404
                };
                logger.debug("No data entity found.");
                return res.render('common/error', data);
            }

            await this.hooks.delete.beforeDelete();

            await models[this.modelName].destroy({
                where: {id: id_entity}
            })

            req.session.toastr = [{
                message: 'message.delete.success',
                level: "success"
            }];

            let redirect = '/ENTITY_URL_NAME/list';
            if (typeof req.body.associationFlag !== 'undefined')
                redirect = '/' + req.body.associationUrl + '/show?id=' + req.body.associationFlag + '#' + req.body.associationAlias;

            await this.hooks.delete.beforeDelete();

            res.redirect(redirect);
            entity_helper.removeFiles(this.entityName, deleteObject, attributes);
        }));
    }
}