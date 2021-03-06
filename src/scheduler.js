'use strict'

const fs         = require('fs')
const Datastore  = require('nedb')
const PdfMake    = require('pdfmake')
const _          = require('lodash')
const Utils      = require('./utils')

const year       = process.argv[2]
const month      = process.argv[3]
const db         = new Datastore({ filename: './resources/datastore.bin', autoload: true })

const additionalInfo = 'Przypominam, że dyżury dzienne są od godz. 6-tej rano a' +
                       'dyżury nocne od godz. 22-tej, tylko za pozwoleniem dyspozytora' +
                       'można zakończyć dyżur przed czasem.'

const Roboto = {
  Roboto: {
    normal:      'fonts/Roboto-Regular.ttf',
    bold:        'fonts/Roboto-Medium.ttf',
    italics:     'fonts/Roboto-Italic.ttf',
    bolditalics: 'fonts/Roboto-Italic.ttf'
  }
}

console.log('I\'m creating scheduler...')

// let driver = {}
// for (let i = 0; i < 91; i++) {
//  driver = {
//    id: (i + 1)
//  }
//  Utils.addDriver(driver, db, function (result) {
//    // to do
//  })
// }

Utils.getDrivers(db, function (result) {
  if (!result) {
    return
  }
  let drivers = _.sortBy(result, 'id')
  let printer = new PdfMake(Roboto)
  
  let scheduler = printer.createPdfKitDocument(makeScheduler(year, month, drivers))

  scheduler.pipe(fs.createWriteStream('./resources/scheduler.pdf'))
  scheduler.end()

  db.persistence.compactDatafile()
})

function createHeader (year, month, daysInMonth) {
  let header = []

  let infoBar = [
    {
      colSpan:   8,
      text:      'HARMONOGRAM DYŻURÓW:\n' + Utils.monthToString(month - 1) + ' ' + year,
      alignment: 'center',
      fontSize:  6
    }, '', '', '', '', '', '', '', '', {
      colSpan:   (daysInMonth - 17),
      text:      'Dyżury niedzielne: parzyste 06:00-06:15, nieparzyste: 10:00-10:15',
      alignment: 'center',
      fontSize:  6
    }]
    
  for (let i = 0; i < (daysInMonth - 17); i++) {
    infoBar.push('')
  }
  
  infoBar = infoBar.concat([{
    colSpan:   8,
    text:      'Kontakt z dyspozytornią:\n508 550 111',
    alignment: 'center',
    fontSize:  6
  }, '', '', '', '', '', '', '' ])

  let title = [{colSpan: (daysInMonth + 1), text: 'HARMONOGRAM', alignment: 'center', fontSize: 7}]
  let daysNums = []
  let daysNames = []

  for (let i = 0; i < daysInMonth; i++) {
    title.push('')
  }
  for (let i = 1; i < daysInMonth + 1; i++) {
    daysNums.push(i.toString())
  }
  daysNums.unshift({
    rowSpan: 2,
    text:    'NR WYW.'
  })
  for (let i = 0; i < daysInMonth; i++) {
    daysNames.push(Utils.numToDay(new Date(year, (month - 1), i).getDay()))
  }
  daysNames.unshift('')
  
  header.push(infoBar, title, daysNums, daysNames)
  return header
}

function makeScheduler (year, month, drivers) {
  const daysInMonth  = new Date(year, month, 0).getDate()
  
  let colsWidth = []
  let header = []
  let body = []
  let days = []

  // set columns width to 'auto'
  for (let i = 0; i < daysInMonth + 1; i++) {
    colsWidth.push('auto')
  }

  console.log('month ' + month + ' in ' + year + ' year, has ' + daysInMonth + ' days')
  header = createHeader(year, month, daysInMonth)
  body = header
  // const dayName     = new Date(year, (month - 1), 0).getDay()
  // console.log('first day in month is: ' + dayName)

  // adds schedule for next month
  drivers.map(function (driver) {
    if (driver.active) {
      // create row with schedule for single driver
      let driverSchedule = []
      for (let i = 0; i < daysInMonth; i++) {
        driverSchedule.push('') // tmp
      }
      driverSchedule.unshift(driver.id.toString())
      // add driver schedule (single row) to general schedule (table) - pdf document
      body.push(driverSchedule)
    }

    if (_.findIndex(driver.scheduleHistory, {year: year, month: month}) === -1 ||
        _.isEmpty(driver.scheduleHistory)) {
      let schedule = {
        year:     year,
        month:    month,
        schedule: []
      }
      for (let i = 0; i < daysInMonth; i++) {
        schedule.schedule.push('')
      }
      driver.scheduleHistory.push(schedule)
    }
  })

  let fromIndex = 0
  let dayOfTheMonth = -1
  // start from spiecified driver
  let startFromIndex = 61
  let assignedNs = 0
  let nightsNum = 0
  
  days = ['PT', 'SO', 'ND', 'PN', 'WT', 'SR', 'CZ']
  
  // populates schedules with Ns
  days.forEach(function (day, id) {
    // console.log('search day: ' + day)
    fromIndex = 0
    dayOfTheMonth = 0
    assignedNs = 0
    nightsNum = 0
    
    // the number of drivers per nights
    switch (day) {
      case 'PT':
        nightsNum = 20
        break
      case 'SO':
        nightsNum = 28
        break
      default:
        nightsNum = 10
    }

    // let i = 0
    while (true) {
      if (assignedNs === 0) {
        // i++
        // find index of selected day in days array (body[3])
        dayOfTheMonth = _.indexOf(body[3], day, fromIndex)
        if (dayOfTheMonth === -1) {
          break
        }
        // console.log(i + ' ' + day + ' is on ' + dayOfTheMonth)
        fromIndex = dayOfTheMonth + 1
      } else {
        // start from first driver in table
        startFromIndex = 4
      }

      // iterate over all drivers in specified column (day) and add N to pdf document
      for (let i = startFromIndex; i < body.length; i++) {
        body[i][dayOfTheMonth] = 'N'
        
        // add N to specified driver schedule in specified general schedule - databse
        let driverId = _.findIndex(drivers, {id: parseInt(body[i][0])})
        if (driverId !== -1) {
          let scheduleId = _.findIndex(drivers[driverId].scheduleHistory, {year: year, month: month})
          if (scheduleId !== -1) {
            drivers[driverId].scheduleHistory[scheduleId].schedule[dayOfTheMonth - 1] = 'N'
          }
        }
        
        assignedNs++
        if (assignedNs === nightsNum) {
          assignedNs = 0
          startFromIndex = i
          // console.log(day + ' end on ' + (startFromIndex - 2))
          startFromIndex++
          break
        }
      }
    }
  })

  let daysNum = 20
  let assignedDs = 0
  dayOfTheMonth = 0
  startFromIndex = 4
  
  // populates schedule with Ds
  while (dayOfTheMonth < (body[2].length - 1)) {
    if (assignedDs === 0) {
      dayOfTheMonth++
      // console.log('compute ' + dayOfTheMonth + ' day of the month')
    } else {
      startFromIndex = 4
    }

    for (let i = startFromIndex; i < body.length; i++) {
      // check if the current or previous day is not 'N'
      // and if is, skip to next 'W' driver

      // to do: check if is it first day in month and
      //        if is, check last day from previous month

      let driverId = _.findIndex(drivers, {id: parseInt(body[i][0])})
      if (driverId !== -1) {
        if (body[i][dayOfTheMonth] === 'N' || body[i][dayOfTheMonth - 1] === 'N') {
          continue
        } else {
          if (dayOfTheMonth === 0) {
            let previousSchedule = _.find(drivers[driverId].scheduleHistory, {year: year, month: (month - 1)})
            if (previousSchedule) {
              if (previousSchedule.schedule[previousSchedule.schedule.length - 1] === 'N') {
                continue
              } else {
                body[i][dayOfTheMonth] = 'D'
              }
            } else {
              // schedule not found - something went wrong
            }
          } else {
            body[i][dayOfTheMonth] = 'D'
          }
        }
        if (body[i][dayOfTheMonth] === 'D') {
          let scheduleId = _.findIndex(drivers[driverId].scheduleHistory, {year: year, month: month})
          if (scheduleId !== -1) {
            drivers[driverId].scheduleHistory[scheduleId].schedule[dayOfTheMonth - 1] = 'D'
          }
        }
      }
        
      assignedDs++
      if (assignedDs === daysNum) {
        assignedDs = 0
        
        startFromIndex = i
        startFromIndex++
        break
      }
    }
  }

  drivers.forEach(function (driver) {
    Utils.updateDriver(driver.id, {scheduleHistory: driver.scheduleHistory}, db, function (result) {
      // to do
    })
  })

  var docDefinition = {
    pageMargins: [ 20, 5, 20, 5 ],
    content:     [
      {
        style: 'custom',
        table: {
          // headerRows: 1,
          widths: colsWidth,
   
          body: body
        }
      },
      {
        text:     additionalInfo,
        fontSize: 8,
        bold:     true,
        margin:   [0, 10, 0, 0]
      }
    ],
    styles: {
      custom: {
        fontSize: 6,
        bold:     true
      }
    }
  }

  return docDefinition
}
