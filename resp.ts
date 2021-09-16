// To parse this data:
//
//   import { Convert } from "./file";
//
//   const welcome = Convert.toWelcome(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface Welcome {
    name: string;
    topLevelDomain: string[];
    alpha2Code: string;
    alpha3Code: string;
    callingCodes: string[];
    capital: string;
    altSpellings: string[];
    region: Region;
    subregion: Subregion;
    population: number;
    latlng: number[];
    demonym: string;
    area: number | null;
    gini: number | null;
    timezones: string[];
    borders: string[];
    nativeName: string;
    numericCode: null | string;
    currencies: Currency[];
    languages: Language[];
    translations: Translations;
    flag: string;
    regionalBlocs: RegionalBloc[];
    cioc: null | string;
}

export interface Currency {
    code: string;
    name: string;
    symbol: null | string;
}

export interface Language {
    iso639_1: string;
    iso639_2: string;
    name: string;
    nativeName: string;
}

export enum Region {
    Europe = "Europe",
}

export interface RegionalBloc {
    acronym: Acronym;
    name: Name;
    otherAcronyms: string[];
    otherNames: any[];
}

export enum Acronym {
    Cefta = "CEFTA",
    Eeu = "EEU",
    Efta = "EFTA",
    Eu = "EU",
}

export enum Name {
    CentralEuropeanFreeTradeAgreement = "Central European Free Trade Agreement",
    EurasianEconomicUnion = "Eurasian Economic Union",
    EuropeanFreeTradeAssociation = "European Free Trade Association",
    EuropeanUnion = "European Union",
}

export enum Subregion {
    EasternEurope = "Eastern Europe",
    NorthernEurope = "Northern Europe",
    SouthernEurope = "Southern Europe",
    WesternEurope = "Western Europe",
}

export interface Translations {
    de: null | string;
    es: string;
    fr: null | string;
    ja: null | string;
    it: null | string;
    br: string;
    pt: string;
    nl: null | string;
    hr: string;
    fa: string;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toWelcome(json: string): Welcome[] {
        return cast(JSON.parse(json), a(r("Welcome")));
    }

    public static welcomeToJson(value: Welcome[]): string {
        return JSON.stringify(uncast(value, a(r("Welcome"))), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any = ''): never {
    if (key) {
        throw Error(`Invalid value for key "${key}". Expected type ${JSON.stringify(typ)} but got ${JSON.stringify(val)}`);
    }
    throw Error(`Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`,);
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) { }
        }
        return invalidValue(typs, val);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases, val);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue("array", val);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue("Date", val);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue("object", val);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, prop.key);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val);
    }
    if (typ === false) return invalidValue(typ, val);
    while (typeof typ === "object" && typ.ref !== undefined) {
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems") ? transformArray(typ.arrayItems, val)
                : typ.hasOwnProperty("props") ? transformObject(getProps(typ), typ.additional, val)
                    : invalidValue(typ, val);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "Welcome": o([
        { json: "name", js: "name", typ: "" },
        { json: "topLevelDomain", js: "topLevelDomain", typ: a("") },
        { json: "alpha2Code", js: "alpha2Code", typ: "" },
        { json: "alpha3Code", js: "alpha3Code", typ: "" },
        { json: "callingCodes", js: "callingCodes", typ: a("") },
        { json: "capital", js: "capital", typ: "" },
        { json: "altSpellings", js: "altSpellings", typ: a("") },
        { json: "region", js: "region", typ: r("Region") },
        { json: "subregion", js: "subregion", typ: r("Subregion") },
        { json: "population", js: "population", typ: 0 },
        { json: "latlng", js: "latlng", typ: a(3.14) },
        { json: "demonym", js: "demonym", typ: "" },
        { json: "area", js: "area", typ: u(3.14, null) },
        { json: "gini", js: "gini", typ: u(3.14, null) },
        { json: "timezones", js: "timezones", typ: a("") },
        { json: "borders", js: "borders", typ: a("") },
        { json: "nativeName", js: "nativeName", typ: "" },
        { json: "numericCode", js: "numericCode", typ: u(null, "") },
        { json: "currencies", js: "currencies", typ: a(r("Currency")) },
        { json: "languages", js: "languages", typ: a(r("Language")) },
        { json: "translations", js: "translations", typ: r("Translations") },
        { json: "flag", js: "flag", typ: "" },
        { json: "regionalBlocs", js: "regionalBlocs", typ: a(r("RegionalBloc")) },
        { json: "cioc", js: "cioc", typ: u(null, "") },
    ], false),
    "Currency": o([
        { json: "code", js: "code", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "symbol", js: "symbol", typ: u(null, "") },
    ], false),
    "Language": o([
        { json: "iso639_1", js: "iso639_1", typ: "" },
        { json: "iso639_2", js: "iso639_2", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "nativeName", js: "nativeName", typ: "" },
    ], false),
    "RegionalBloc": o([
        { json: "acronym", js: "acronym", typ: r("Acronym") },
        { json: "name", js: "name", typ: r("Name") },
        { json: "otherAcronyms", js: "otherAcronyms", typ: a("") },
        { json: "otherNames", js: "otherNames", typ: a("any") },
    ], false),
    "Translations": o([
        { json: "de", js: "de", typ: u(null, "") },
        { json: "es", js: "es", typ: "" },
        { json: "fr", js: "fr", typ: u(null, "") },
        { json: "ja", js: "ja", typ: u(null, "") },
        { json: "it", js: "it", typ: u(null, "") },
        { json: "br", js: "br", typ: "" },
        { json: "pt", js: "pt", typ: "" },
        { json: "nl", js: "nl", typ: u(null, "") },
        { json: "hr", js: "hr", typ: "" },
        { json: "fa", js: "fa", typ: "" },
    ], false),
    "Region": [
        "Europe",
    ],
    "Acronym": [
        "CEFTA",
        "EEU",
        "EFTA",
        "EU",
    ],
    "Name": [
        "Central European Free Trade Agreement",
        "Eurasian Economic Union",
        "European Free Trade Association",
        "European Union",
    ],
    "Subregion": [
        "Eastern Europe",
        "Northern Europe",
        "Southern Europe",
        "Western Europe",
    ],
};
