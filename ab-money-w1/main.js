﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/
var g_headers = {
	'Origin':'https://www.walletone.com',
	'JS-Framework':'Basis',
	'User-Agent':'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36',
	'Accept': '*/*',
	'Content-type': 'text/xml;charset=utf-8',
	'Referer':'https://www.walletone.com/client/?attempt=1',
};

function encryptPass(pass) {
	AnyBalance.trace('Trying to encrypt pass: ' + pass);
	pass = Basis.Crypt(pass).sha1(!0).base64().toString();
	AnyBalance.trace('Encrypted pass: ' + pass);
	return pass;
}

function main() {
	AnyBalance.setDefaultCharset('utf-8');
	var prefs = AnyBalance.getPreferences(),
	currency = {
		980: '₴',
		398: '₸',
		643: 'р',
		710: 'ZAR',
		840: '$',
		978: '€'
	},
	currencyCode = prefs.currency || 643;
	
	checkEmpty(prefs.login, 'Введите логин!');
	checkEmpty(prefs.password, 'Введите пароль!');
	
	var html = AnyBalance.requestGet('https://www.walletone.com/client/?attempt=1', g_headers);
	
	var loginXml = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><ParamsHeader xmlns="Wallet.Security.WebService"><Params><Param Name="CultureId" Value="ru-RU"/></Params></ParamsHeader></soap:Header><soap:Body><GetSessionTicket xmlns="Wallet.Security.WebService"><Login>'+ prefs.login +'</Login><Password>' + encryptPass(prefs.password) +'</Password><LoginType>Auto</LoginType><ClientId>w1_web</ClientId><Params><Param Name="UserAgent" Value="Chrome 31.0.1650.63"/><Param Name="ClientResolutionX" Value="1920"/><Param Name="ClientResolutionY" Value="1080"/><Param Name="AppVersion" Value="201312260718-test"/></Params></GetSessionTicket></soap:Body></soap:Envelope>';
	// Получаем SessionKey
	html = AnyBalance.requestPost('https://www.walletone.com/w1service/SecurityService.asmx', loginXml, addHeaders({
		'SOAPAction': 'Wallet.Security.WebService/GetSessionTicket'
	}));
	var SessionUserId = getParam(html, null, null, /<SessionUserId>([\s\S]*?)<\/SessionUserId>/i);
	var SessionKey = getParam(html, null, null, /<SessionKey>([\s\S]*?)<\/SessionKey>/i);
	if (!SessionKey || !SessionUserId) 
		throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
	var balanceXml = '<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><SecurityHeader xmlns="Wallet.Processing.WebService"><SessionKey>' + SessionKey + '</SessionKey></SecurityHeader><ParamsHeader><Params><Param Name="CultureId" Value="ru-RU" /></Params></ParamsHeader></soap:Header><soap:Body><GetUserBalance xmlns="Wallet.Processing.WebService" /></soap:Body></soap:Envelope>';
	html = AnyBalance.requestPost('http://services.w1.ru/11/ProcessingService.asmx', balanceXml, addHeaders({
		'SOAPAction': 'Wallet.Processing.WebService/GetUserBalance'
	}));
	if (/<faultstring>/i.test(html)) {
		var error = getParam(html, null, null, /<faultstring>[\s\S]*:\s*([\s\S]*?)<\/faultstring>/i, replaceTagsAndSpaces, html_entity_decode);
		if (error) throw new AnyBalance.Error(error);
		throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
	}
	var result = {success: true};
	getParam(html, result, 'balance', new RegExp("<CurrencyId>" + currencyCode + "<\/CurrencyId>(?:<Amount>){1}([\\s\\S]*?)<\/Amount>", "i"), replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'SafeAmount', new RegExp("<CurrencyId>" + currencyCode + "<\/CurrencyId>[\\s\\S]*(?:<SafeAmount>){1}([\\s\\S]*?)<\/SafeAmount>", "i"), replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'HoldAmount', new RegExp("<CurrencyId>" + currencyCode + "<\/CurrencyId>[\\s\\S]*(?:<HoldAmount>){1}([\\s\\S]*?)<\/HoldAmount>", "i"), replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'Overdraft', new RegExp("<CurrencyId>" + currencyCode + "<\/CurrencyId>[\\s\\S]*(?:<Overdraft>){1}([\\s\\S]*?)<\/Overdraft>", "i"), replaceTagsAndSpaces, parseBalance);
	result.currency = currency[currencyCode];
	AnyBalance.setResult(result);
}