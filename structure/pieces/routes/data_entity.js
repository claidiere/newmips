const DataEntity = require('./_core/data_entity.js');
const block_access = require('../utils/block_access');

class MODEL_NAME extends DataEntity {
    constructor() {
        const additionalRoutes = [];
        super('ENTITY_NAME', additionalRoutes);
    }

    get hooks() {
        return {
            list: {
                beforeRender: async () => {}
            },
            datalist: {
                beforeDBQuery: async () => {},
                afterDBQuery: async () => {}
            },
            subdatalist: {
                defineInclude: async () => {},
                beforeEntityCreate: async () => {},
                afterEntityCreate: async () => {}
            },
            show: {

            },
            create_form: {
                beforeDataLoad: async () => {},
                beforeRender: async () => {}
            },
            create: {
                beforeBodyParse: async () => {},
                afterBodyParse: async () => {},
                beforeEntityCreate: async () => {},
                afterEntityCreate: async () => {},
                beforeRender: async () => {}
            },
            update_form: {
                beforeDataLoad: async () => {},
                beforeRender: async () => {}
            },
            update: {
                beforeBodyParse: async () => {},
                afterBodyParse: async () => {},
                beforeEntityCreate: async () => {},
                afterEntityCreate: async () => {},
                beforeRender: async () => {}
            },
            loadtab: {
                beforeDBQuery: async () => {},
                afterDBQuery: async () => {},
                beforeTabTypeSelection: async () => {},
                afterTabTypeSelection: async () => {},
                promisesArrayResolved: async () => {},
                beforeRender: async () => {}
            },
            set_status: {
                beforeStatusChange: async () => {},
                afterStatusChange: async () => {}
            },
            search: {
                beforeDBQuery: async () => {},
                afterDBQuery: async () => {}
            },
            fieldset_remove: {
                afterRemove: async () => {}
            },
            fieldset_add: {
                afterAdd: async () => {}
            },
            delete: {
                beforeDelete: async () => {},
                afterDelete: async () => {}
            }
        }
    }

    get middlewares() {
        return {
            list: [
                block_access.actionAccessMiddleware(super.entityName, "read")
            ],
            datalist: [
                block_access.actionAccessMiddleware(super.entityName, "read")
            ],
            subdatalist: [
                block_access.actionAccessMiddleware(super.entityName, "read")
            ],
            show: [
                block_access.actionAccessMiddleware(super.entityName, "read")
            ],
            create_form: [
                block_access.actionAccessMiddleware(super.entityName, "create")
            ],
            create: [
                block_access.actionAccessMiddleware(super.entityName, "create")
            ],
            update_form: [
                block_access.actionAccessMiddleware(super.entityName, "update")
            ],
            update: [
                block_access.actionAccessMiddleware(super.entityName, "update")
            ],
            loadtab: [
                block_access.actionAccessMiddleware(super.entityName, "read")
            ],
            set_status: [
                block_access.actionAccessMiddleware(super.entityName, "read")
            ],
            search: [
                block_access.actionAccessMiddleware(super.entityName, "read")
            ],
            fieldset_remove: [
                block_access.actionAccessMiddleware(super.entityName, "delete")
            ],
            fieldset_add: [
                block_access.actionAccessMiddleware(super.entityName, "create")
            ],
            destroy: [
                block_access.actionAccessMiddleware(super.entityName, "delete")
            ]
        }
    }
}

module.exports = MODEL_NAME;