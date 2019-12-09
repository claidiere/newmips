const fs = require('fs-extra');

const regExp = new RegExp('{(((?:[#\/]|[a-zA-Z]))(?!__)[^\n]*)}', 'g');
const fieldsArray = [];

function fetchFieldsFromString(string) {
	let matches, currentPath = '';
	while ((matches = regExp.exec(string)) !== null) {
		let [fullMatch, fieldPath, openingChar] = [...matches];
		// New context, add to currentPath
		if (openingChar == '#')
			currentPath = currentPath == '' ? fieldPath.substr(1) : currentPath+'.'+fieldPath.substr(1);
		// Closing context, remove from currentPath if exist
		else if (openingChar == '/') {
			fieldPath = fieldPath.substr(1);
			const lastPathIdx = currentPath.lastIndexOf(fieldPath);
			if (currentPath.substr(lastPathIdx) == fieldPath)
				currentPath = currentPath.replace(new RegExp('\.?'+fieldPath), '');
		}
		// Field
		else
			fieldsArray.push(currentPath == '' ? fieldPath : currentPath+'.'+fieldPath)
	}
}

const dust = fs.readFileSync(__dirname+'/test_dust.dust', 'utf8');
fetchFieldsFromString(dust);
console.log(fieldsArray);