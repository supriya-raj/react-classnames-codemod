let getNestedPathObject = (rootPath, attributes) => {
        if(!Array.isArray(attributes)) {
            attributes = [attributes]
        }
        if(!attributes || !attributes.length ) {
            return rootPath;
        }
        return getNestedPathObject(rootPath.get(attributes[0]), attributes.slice(1)) 
    };

module.exports = {
    getNestedPathObject
};