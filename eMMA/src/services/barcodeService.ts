import { BarcodeScanner } from 'ionic-native';
import myPako from "../../node_modules/pako"
import { Storage } from '@ionic/storage';
import { HCIService } from './HCIService';
import { Http } from '@angular/http';
import { HciHospAPI } from 'hci-hospindex-api';
import  * as  HCITypes from 'hci-hospindex-api/src/api';
import { chmedJsonHandler } from '../services/chmedJsonHandler';

/*----------------------------------------------------------------------------*/
/* barcodeService
/* tschm2
/* In this class the BarcodeScanner is getting Handled!
/* All Function with scanning single Medication or the eMediplan are included
/*
/*----------------------------------------------------------------------------*/

export class barcodeService {
private list: Array<any>;
private chmedHandler: chmedJsonHandler;

  /**
     * @param  {Storage}               publicstorage    ionic storage from phone
   */
  constructor(public http: Http, public storage: Storage) {
    this.chmedHandler = new chmedJsonHandler(this.storage)
  }

  /*----------------------------------------------------------------------------*/
  /* This Method is used to Scan the QR-Code of the eMediplan
  /* It returns a Promise with True or False if the scan was successfull
  /*----------------------------------------------------------------------------*/
  scanQRcodeForJSON():any{

  return BarcodeScanner.scan().then((barcodeData) => {
    let strData: string = this.chmedHandler.chmedToString(barcodeData.text)
      this.storage.ready().then(() => {
      var mediPlan = JSON.parse(strData)
      this.storage.set("mediPlan", mediPlan).then(()=>{
        this.doChecksWithCurrentMedication()
      });
      this.IdHCIQuery(mediPlan).then((res) => {
          this.storage.set("medicationData", res);
            var tempMedicationData = res;
            var complianceObj = ({        //new object
            "ID":"1",
            "Date":"dateOfMediplan",
            "DrugList":[]
            })
            for(var pos in tempMedicationData){ //new drug obj for every drug in the DrugList
              complianceObj.DrugList.push({
                "Name":tempMedicationData[pos].title,
                "Compliance":[]
              })
            }
           this.storage.set('ComplianceData',complianceObj)//save to storage
          })
        });


      return true
      // Success! Barcode data is here
    }, (err) => {
      alert("Woops falscher QR-Code, zu Testzwecken wurde DummyData gespeichert");
      this.testDummyData()
      return false
    })
  }

  /*----------------------------------------------------------------------------*/
  /* This Method is used to add the Title and Full Description of the Medication
  /* In the QR-Code of the eMediplan only the Pharmacode of the Medication is stored
  /* To get the description a Call to the HCI Solutions Database is needed
  /*
  /* Returns a list of Promises, because multiple accesses to the Database is needed!
  /*----------------------------------------------------------------------------*/
  IdHCIQuery(medData){
    this.list = new Array<any>();
    var hciS = new HCIService();
    for (let medi of medData['Medicaments']){
      if(Number(medi.Id)){
        var l = hciS.hciquery(medi.Id,"phar").then((responseXML)=>{
          var xml =  responseXML;
          var art = xml.getElementsByTagName("ART");
          var desc = art[0].getElementsByTagName("DSCRD")[0].textContent
          var title = desc.split(" ")[0];
          medi.description = desc
          medi.title = title
        });
      }
      else{
        medi.description = medi.Id
        medi.title = medi.Id
      }
      this.list.push(l)
    }

    return Promise.all(this.list).then((res) => {
      return(medData['Medicaments']);
    });
  }

  /*----------------------------------------------------------------------------*/
  /* This Method is used to add Selfmedication to the Array
  /* The Scan of the Barcode only has the ArticleNumber on it.
  /* To get the full Data of the Medication a call to the HCI Solutions Database
  /* is needed!

  /* Returns a Promise when successfully done.
  /*----------------------------------------------------------------------------*/
  scanMediCode(medData,morning,midday,evening,night,reason):Promise<any>{

    if(morning==true)morning=1
    else morning = 0
    if(midday==true)midday=1
    else midday = 0
    if(evening==true)evening=1
    else evening = 0
    if(night==true)night=1
    else night = 0

    var hciS = new HCIService()
    return BarcodeScanner.scan().then((barcodeData) => {
      return hciS.hciquery(barcodeData.text,"ARTBAR").then(function(response) {
        console.log(response);
        var xml =  response;
        var art = xml.getElementsByTagName("ART");
        var desc = art[0].getElementsByTagName("DSCRD")[0].textContent
        var title = desc.split(" ")[0];
        var today:any = new Date();
        var dd:any = today.getDate();
        var mm:any = today.getMonth()+1; //January is 0!
        var yyyy:any = today.getFullYear();
        if(dd<10) {
            dd='0'+dd
        }

        if(mm<10) {
            mm='0'+mm
        }
        today = yyyy+'-'+dd+'-'+mm;

        var tempObj = ({
          "AppInstr":"Arzt oder Apotheker fragen.",
          "TkgRsn":reason,
          "AutoMed":"1",
          "Id":art[0].getElementsByTagName("PHAR")[0].textContent,
          "IdType":"3",
          "description":desc,
          "title":title,
          "PrscbBy":"mir als Patient",
          "Pos":[{
            "D":[
              morning,
              midday,
              evening,
              night
            ],
            "DtFrom":today
          }]
        })
        medData.push(tempObj)
        return medData
      })
      }, (err) => {
        console.log(err)
      })
  }

  /*----------------------------------------------------------------------------*/
  /* This Method is used to do all the needed checks for the Medication
  /* At the moment this method only checks for Doping and nutrition
  /* "stringChecks" can be adapted!

  /* Saves the checks in the storage: "checks"
  /*----------------------------------------------------------------------------*/
  doChecksWithCurrentMedication(){
        let grouping:HCITypes.grouping = "byProduct"
        let extent:HCITypes.extent  = 'full';
        let checks=[];
        let stringChecks = [];
        stringChecks.push("doping", "nutrition")

        for (var item of stringChecks) {
          let tempCheck:HCITypes.checkType = item
          let tCheck = {
            check:tempCheck
          } as HCITypes.check
          checks.push(tCheck)
        }

        this.chmedHandler.getCHMEDString().then((chmed16) => {
          console.log(chmed16)
        let medication = chmed16
        let hciCdsCheckRequest = {
           medication: medication,
           extent: extent,
           grouping: grouping,
           checks: checks
        } as HCITypes.hciCdsCheckRequest;

        HciHospAPI.hciCdsCheck(hciCdsCheckRequest).then((res)=>{
          this.storage.set("checks", res);
        })
      })
  }
  /*----------------------------------------------------------------------------*/
  /*
  /*----------------------------------------------------------------------------*/

/* To Be Deleted */

        testThisNow(chmed){
          var testData = "CHMED16A1eJytVM1u2kAQfpWNr7GjXduAzS0JoUUJLSK0kVrlsLYHvMJeo/W6TUC8TR6jt7xYZ+04JQFyqoTxeGd25ptvfjbWeaVTq2/1upRR6rnUDzs9y7YGGg9dyroOow4LZizoM6/veafU7VOKBqMEDSLfm4fdaO7488B1fAgjJ+RR4IQxjefBPOjw0DgbQzJ7XIHVZ7UsYp6D1KXV/7mxzlerkSy1Qm+SxylJICdXZQmyjeH7IWNeE7Lx4tnWpGhuD/Cf2dTG596AHqoib4HTEH91KrNi54yF1hZtJ6qMo4tHVAzUGflSaDJUXK5t86pAziFL8O604Ggx+YribLmYlhK/RqhcalEYhN+kMETdzq6trb1pALsBo17X/xgwPQTYcyg7AO5crTX5zGVpk/HzHxmnIFNeNRQdAniRYU2LOE1UFS+PgGSh2/PdD1ilx1j9TyAv0yKDUoMSEo2WoPaB7rZGpYg4y89sYqSkUtgpwugqAUoDmYAqCwnypO0al7HA946n5x6sQcdhDDM8kN7VA89XGZBrrjKb3D0/yYV4zWw0fkM/qCoVi0ou/qU0vnmfUQSCXEDC1RytcAgLHIx6QGr4OAFi8VvES8h2cmD7JTrYRy+NP5JTQGtmsnlFNxQQ7ZLt7AETJVlXJOcPZ8THV0b089MiE8g4IzMeZaCRcBBSQprX5d1D7/e6HvN6R9j/ECsinTVmRWNGt/dvq/F+Ux1qrtsYoak1vB9R44hrgcvH6m+si3rJsdD36rIzNL4U2sS441liMtZNEYdfcGGZIKBr6j6BTFAwaG9eVOOqbHQ3eANb5qpZeybM4KbUYzCw6jPe0PBa0Qafa1vfeYY2AasL0qjdVs1aNQtoncY0rr2MGtan+NHp9e7b8XZbwWsFvxU6rdBtrzEkeIvEpDhAGOHUZ6QXEuZ6xO+QrqH4VisA3bT2AruE434mzGy4H2KFx6Eb4lJFf/nS5A6KvLBMRKnJryInZusvuVma5SrjkkSwAGEY0yfW9i+0wN/G"

          var b64Data  =   testData.substring(9);

          // Decode base64 (convert ascii to binary)
          var strData     = atob(b64Data);

          // Convert binary string to character-number array
          var charData    = strData.split('').map(function(x){return x.charCodeAt(0);});

          // Turn number array into byte-array
          var binData     = new Uint8Array(charData);

          // Pako magic makeing
          var data        = myPako.inflate(binData);

          // Convert gunzipped byteArray back to ascii string:


          let strData2: string  = String.fromCharCode.apply(null, new Uint16Array(data));


            var mediPlan = JSON.parse(strData2)
            console.log("PLEASE")
            console.log(mediPlan)



  }


  analyseCHMED(){
    var testData = "CHMED16A1H4sIAAAAAAAAA61VzXLiOBB+lR5fxxBJNmBzIyHZdQ0ECjyZqt3KQRgBWmyZkuWpmaTyNvMYc8s77XlbVpwwWZK9bBXGbfWP9H39uX3vjWqz84beoE8oIQEjYdwbeL43NrjICO13KOnQKKXRkAbDIPhI2JAQDEjWGLAKg03cX2064SZinVDEq07MV1Enzki2iTZRj8e22FSs0+8H4Q1pY8uMF0KZyhv+ee+NDodEVUZjNcWzHaxFAZdVJVS7RxjGlAZuS1cl8L156bLH+E994uN1aw99pcuiPTiJ8ddAScujNRp7Dxg711W2Ov+OjrHuwnVp4EpzdefbWy3URuRrzF2UHCPmMzTT/XZRKXxK0Lk3srQn/KykJWqZfsKHtagyLQ+Na+idjy7SRTKFTamNgJSvcogIOaN9UmyBEliaPeYYaXLxEu09+PcONosoCfrh+7DJKdhBh9ATEEf6zsDvXFU+TB9/qmwn1I7XjuhTMM9zVEaZ7da6zvbvQ72YdcbJ7GZ0DVcyL4yFijDPKOv2AMGy6BXY5/gXuDRmg5C902XyVpf/J7gXuzIXlRFaKgzaC/0+5OVskSbLF7yMWKTB67a6sAbmsdBrDbJbdH2w1rrWqHtpfbUUVixzoatSCfWhfQcYpVEYvE0OO6mFXodS5OcEOZffeHHIBXziOvfhy+MPtZXPvKAKj2UgdL2T21ptXwiZTv7Fx81oknyeQqL+gsnfldV3sT1jRd7gPJPdr13owag4AIMiPyLI5SFBqs7zX1layQruaij4ty6EeMvBPP7Y5hLJos37JAxyJaRSYlc0fcVZVuJ8aeaMmx2DfkCDwRvEnZwWiVqIqqmQpi6sdGHk4fZXIl+PzFOqWmZ4NH0n/mNWzEfXo/FsAkeC6pFGUey1op5CXVO5kThIveG9d94MbBqHQdN0ihkX0thjfuH52pJmXAuvrnH42jrCNBr/Tag1Ghbw5Mk1rSvnm2AGCubSjXC7zXhSmamwR27WuGPyebg7iMz3bniOMRFtlO/crHXT1k0j0sBYZE2VxDVugQ+9weC2HQ2sNYLWCFuj1xr9No1ijx6QmB2+PrjDx5DCIAbKAgh70LddWhothHHC3qLQOH5rgNo5+4c84HLMYvxAYL1ib7ELDU8sg6wMfC0LsF+wPbedqw45V7ASWyEtY+aD9/APcU6IyFEHAAA="
    var b64Data  =   testData.substring(9);
    // Decode base64 (convert ascii to binary)
    var strData     = atob(b64Data);
    // Convert binary string to character-number array
    var charData    = strData.split('').map(function(x){return x.charCodeAt(0);});
    // Turn number array into byte-array
    var binData     = new Uint8Array(charData);
    // Pako magic makeing
    var data        = myPako.inflate(binData);
    // Convert gunzipped byteArray back to ascii string:
    let strData2: string  = String.fromCharCode.apply(null, new Uint16Array(data));

    var mediPlan = JSON.parse(strData2)
    console.log(mediPlan)
  }
  testDummyData(){
    var testData = "CHMED16A1H4sIAAAAAAAAA9VWzXLiOBB+lR5fBxPJNsbm5oRhlhpIKGAyVbuVgzDCaLFlSpbnJ6m8zTzG3vJOe96WjROHkOzW1l62ih9Z3ZL6+/rrtu6sqNRba2D1fUIJcR3ihb2+1bGGGicdQn2bEpsGSxoMqDtw3ffEGRCCDuM1Oqw8dxP6q43tbQLH9ni4skO2CuwwJvEm2AQ9FprNpny9/LHn1oBWYxGzjEtdWIPf7qxovx/LQivcTbJ4C2uewYei4LI5w/NCSt36yHoXt2PN8nr1EH9ph3Twe2OCHqk8awInIX4qKMu8NUdD6x59Z6qIV+c/0DBUXbjMNYwUk7cd81dyueHpGtfOc4YesyscLnfJvJD4NEbjTovcRPhZCkPUYvkJH9a8iJXYV6aBdR5dLOfjKWxypTks2SqFgJAz6pMsAUpgoXe4Rgud8idv675zV8N2Akpc33sbNjkF27UJPQExUrcafmGy6MD04Q8Zb7ncsrIm+hTM8xSVkcfbtSrj3dtQL67s4fjqOrqEkUgzbaAizDPqdHuAYJ3gCOyj/xNcGjp9z3kjy+S1LP9HcC+2ecoLzZWQ6LTj6m3Ii6v5crx4wusQg9Q9TmvtVsFsC71UILpZtwNmtC4V6l4YWym4EcuMqyKXXL5rasChNPDc18lxTmqhZ1OK/Jwg58N3lu1TDp+YSjvw5eGnTMQjL6jCtgy4KrciKWXyRMh08oKP62gy/jyFsfwdJn8WRt9ZcuZkaYXzTHS/dqEHUbYHB7K0RVC97pigFRdwztdMbdAVO1SOXaPqHhUb2B5E8k3EO562KKEv9XKyPA5dYSznHL2pIecR7EjwVTvz9gucz89uULRnj6GIAm5LyNj3Lnj4l4J++JmkAlNOq67ANWacCyn5NqvU+QKv1/dd6vZfSf+b6BDbsnbLazdyf/NcDseN/1RtLGIMTd3yv+l4s+gyGl5NoFUWPVLVhXNcFwfXY7Kqos3XXEG0z/WWYxnCRrGEy247nhFr02TRpkyo6/r+s1eF5b6IchiNoslH7FXLVoDUPwqw8bLaXGVCAUsLmDEt8AVm/ZOG3LeJY5MeFuG/wzr8f2F1D1iNxg4rB3fWeXWdoKHnVi3JgLgQ2hzzhaVrUwy6bjCjS7waGH1wXdXhRy6RoUrIk4NpWha1bYIrMPgP9QXDHDOcFHrKDfBqjtXxPraHWrpOx7pmKfoEtJJfbXYaM23MNCBV55zH1S7juiDn+NDr92+aF5fTDNxm4DWDXjPwm2X0xqjAmm2xueMJ7z0K/RCo44LXA99U30IrznXddhPUCcObEFBzC/hV7HE6dEK8vuB+2c5gR8kcWAZRaPiaZ2DuVztm8l/sUyZhxRMuDGP6nXX/Fx1DXbHvCQAA"
    var b64Data  =   testData.substring(9);

    // Decode base64 (convert ascii to binary)
    var strData     = atob(b64Data);

    // Convert binary string to character-number array
    var charData    = strData.split('').map(function(x){return x.charCodeAt(0);});

    // Turn number array into byte-array
    var binData     = new Uint8Array(charData);
    // Pako magic makeing
    var data        = myPako.inflate(binData);

    // Convert gunzipped byteArray back to ascii string:

    let strData2: string  = String.fromCharCode.apply(null, new Uint8Array(data));

/*    var  re = /[ÀÁÂÃÄÅ]/g;
strData2 =  strData2.replace(re,"A");*/
    console.log(strData2)
  strData2 = this.convert_accented_characters(strData2)
    console.log(strData2)
    this.storage.ready().then(() => {
      var mediPlan = JSON.parse(strData2)
      console.log(mediPlan)
      this.storage.set("mediPlan", mediPlan);
      this.getNamesFromID(mediPlan).then((res) => {
          this.storage.set("medicationData", res);
      });
    })

    }

    getNamesFromID(medData){
             this.list = new Array<any>();
             var hciS = new HCIService();
             for (let medi of medData['Medicaments']){
               var l = hciS.getHCIData(this.http,medi.Id,"phar").then(function(response) {
                     if(Number(medi.Id)){
                     var result = JSON.parse(response._body);
                     var desc = result.article[0].dscrd;
                     var title = desc.split(" ")[0];
                     medi.description = desc
                     medi.title = title
                   }
                   else{
                     medi.description = medi.Id
                     medi.title = medi.Id
                   }
               });

               this.list.push(l);
             }

               return Promise.all(this.list).then((res) => {
                 return medData['Medicaments'];
               });
             }

   convert_accented_characters(str){
    var conversions = new Object();

    conversions['ü'] = 'Ã¼|ï¿½';
    conversions['ä'] = 'Ã¤';
    conversions['ö'] = 'Ã¶';
    conversions['Ö'] = 'Ã';
    conversions['Ü'] = 'Ã';
    conversions['Ä'] = 'Ã';
    for(var i in conversions){
        var re = new RegExp(conversions[i],"g");
        str = str.replace(re,i);
    }

    return str;
}
}
