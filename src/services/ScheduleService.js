import StorageService from './StorageService'
import utils          from '../utils'
import async          from 'async'
import _              from 'lodash'

const ipcRenderer = window.require('electron').ipcRenderer

module.exports = {
  createSchedule: createSchedule,
  checkSchedules: checkSchedules
}

function checkSchedules (done) {
  ipcRenderer.once('check-schedules-reply-err', (event, err) => done(err))
  ipcRenderer.once('check-schedules-reply', (event, files) => {
    // console.log('CHECK SCHEDULES')
    StorageService.getSchedules((err, schedules) => {
      if (err) return done(err)
      if (!schedules.length) return done()

      const scheduleNames = schedules.map((schedule) => schedule.filename)
      async.each(scheduleNames, (scheduleName, next) => {
        if (_.findIndex(files, (file) => file === scheduleName) === -1) {
          console.log('remove: ' + scheduleName)
          StorageService.deleteSchedule(scheduleName, next)
        } else {
          next()
        }
      }, (err) => {
        if (err) return done(err)

        return done()
      })
    })
  })

  ipcRenderer.send('check-schedules', null)
}

function createSchedule (options, done) {
  const nextMonth     = utils.monthToNum(options.month) + 1
  const daysInMonth   = new Date(options.year, nextMonth, 0).getDate()
  const pdfName       = 'grafik-' + options.year + '-' + options.month + '.pdf'

  options.filename = pdfName
  options.daysInMonth = daysInMonth

  StorageService.prepareScheduleDocument(options, (err, scheduleDocument) => {
    if (err) return done(err)

    _createScheduleTable(scheduleDocument, (err, scheduleHeader, scheduleTable, scheduleDocument) => {
      if (err) return done(err)

      StorageService.addSchedule(scheduleDocument, (err, scheduleDocument) => {
        if (err) return done(err)

        const colsWidth = []
        colsWidth[0] = 16

        // set columns width to 'auto'
        for (let i = 1; i < daysInMonth + 1; i++) {
          colsWidth.push(9)
        }

        const margins = daysInMonth === 31 ? 6 : 15
        const pdfDefinition = {
          pageMargins: [ margins, 68, margins, 65 ],
          header:      [
            {
              style: {
                fontSize: 6,
                bold:     true
              },
              table: {
                widths: colsWidth,
                body:   scheduleHeader
              },
              margin: [ margins, 6, margins, 0 ]
            }
          ],
          footer: [
            {
              text:     options.message,
              fontSize: 12,
              bold:     true,
              margin:   [margins, 5, margins, 10]
            }
          ],
          content: [
            {
              style: 'custom',
              table: {
                widths: colsWidth,
                body:   scheduleTable
              }
            }
          ],
          styles: {
            custom: {
              fontSize: 8,
              bold:     false
            }
          }
        }

        ipcRenderer.once('generate-schedule-reply', (event, arg) => {
          console.log('Schedule table generated successfully')
          done()
        })
        ipcRenderer.send('generate-schedule', pdfDefinition, pdfName)
      })
    })
  })
}

function _createScheduleTable (scheduleDocument, done) {
  const year        = parseInt(scheduleDocument.date.year)
  const month       = utils.monthToNum(scheduleDocument.date.month)
  const daysInMonth = scheduleDocument.date.daysInMonth
  const exceptions  = scheduleDocument.exceptions
  const days        = ['PT', 'SO', 'ND', 'PN', 'WT', 'SR', 'CZ']

  // console.log('year: ' + year)
  // console.log('month: ' + (parseInt(month) + 1))
  // console.log('daysInMonth: ' + daysInMonth)
  console.log('Schedule exceptions:')
  console.log(exceptions)

  // create schedule header
  const _header = _createScheduleHeader(year, month, daysInMonth)
  let body = _createScheduleHeader(year, month, daysInMonth)

  // add row for each driver
  scheduleDocument.schedule.forEach((_schedule) => {
    const schedule = _.cloneDeep(_schedule)
    schedule.driverSchedule.unshift(schedule.driverId)
    body.push(schedule.driverSchedule)
  })

  // internal counters
  let fromIndex     = 0
  let assignedNs    = 0
  let nightsNum     = 0
  let dayOfTheMonth = -1
  let nextDay       = true
  let currentDay    = 'PT'

  // start from spiecified driver
  let startFromIndex
  const firstDriverId = scheduleDocument.options.firstDriver

  for (let i = 4; i < body.length; i++) {
    // console.log(body[i][0])
    if (body[i][0] === firstDriverId) {
      startFromIndex = i
      break
    }
  }

  // console.log('startFromIndex: ' + startFromIndex)
  // console.log(body)

  // populate schedule with Ns (nights)
  days.forEach((day, id) => {
    // console.log('search day: ' + day)
    fromIndex = 0
    dayOfTheMonth = 0
    assignedNs = 0
    nightsNum = 0
    currentDay = day

    while (true) {
      console.log('dayOfTheMonth: ' + dayOfTheMonth)
      if (nextDay) {
        // find index of selected day in days row (body[3])
        dayOfTheMonth = _.indexOf(body[3], day, fromIndex)
        if (dayOfTheMonth === -1) break // search for another day name (PT, SO, ...)

        const exc = _.find(exceptions, (exc) => parseInt(exc.dayDate) === dayOfTheMonth)
        if (exc !== undefined) {
          console.log('EXCEPTION !')
          console.log(exc)

          nightsNum = exc.nocturnalDrivers
        } else {
          // the number of drivers per nights
          switch (currentDay) {
            case 'PT':
              nightsNum = scheduleDocument.options.fridayNightNum
              break
            case 'SO':
              nightsNum = scheduleDocument.options.saturdayNightNum
              break
            default:
              nightsNum = scheduleDocument.options.otherNightsNum
          }
        }

        nextDay = false
        fromIndex = dayOfTheMonth + 1
        nightsNum = parseInt(nightsNum)
      } else {
        // start from first driver in table
        startFromIndex = 4
      }
      // iterate over all drivers in specified column (day)
      // and add N to pdf document
      for (let i = startFromIndex; i < body.length; i++) {
        const currentDriverId = parseInt(body[i][0])

        // find schedule table for given driver in db
        let driverSchedule = _.find(scheduleDocument.schedule, {driverId: currentDriverId})
        // console.log(driverSchedule)
        if (driverSchedule && driverSchedule.nocturnalActivity) {
          // add N to specified driver schedule
          driverSchedule.driverSchedule[dayOfTheMonth - 1] = 'N'
        } else {
          // console.log('skip!!!')
          continue
        }

        body[i][dayOfTheMonth] = { text: 'N', bold: true }

        assignedNs++
        if (assignedNs === nightsNum) {
          assignedNs = 0
          nextDay = true
          startFromIndex = i
          startFromIndex++
          if (startFromIndex === body.length) {
            startFromIndex = 4
          }
          break
        }
      }
    }
  })

  let daysNum    = 0
  let assignedDs = 0
  const previousMonthDrivers = scheduleDocument.options.previousMonthDrivers

  nextDay = true
  startFromIndex = 4
  dayOfTheMonth = 0

  while (true) {
    if (nextDay) {
      nextDay = false
      dayOfTheMonth++
      // console.log('day: ' + dayOfTheMonth)
      if (dayOfTheMonth > daysInMonth) break

      const exc = _.find(exceptions, (exc) => parseInt(exc.dayDate) === dayOfTheMonth)
      if (exc !== undefined) {
        console.log('EXCEPTION !')
        console.log(exc)

        daysNum = parseInt(exc.dayDrivers)
      } else {
        daysNum = parseInt(scheduleDocument.options.allDaysNum)
      }
    } else {
      startFromIndex = 4
    }

    for (let i = startFromIndex; i < body.length; i++) {
      const currentDriverId = parseInt(body[i][0])
      const driverSchedule  = _.find(scheduleDocument.schedule, {driverId: currentDriverId})

      if (driverSchedule && driverSchedule.dailyActivity) {
        if (dayOfTheMonth === 1) {
          // check last day from previous month
          if (_.findIndex(previousMonthDrivers, (id) => id === currentDriverId) !== -1) {
            // console.log('got night in previous day - skip: ' + currentDriverId)
            continue
          } else if (body[i][dayOfTheMonth].text === 'N') {
            continue
          } else {
            driverSchedule.driverSchedule[dayOfTheMonth - 1] = 'D'
            body[i][dayOfTheMonth] = 'D'
          }
        } else {
          // check if the current or previous day is not 'N'
          // and if is, skip to next driver
          if (body[i][dayOfTheMonth].text === 'N' || body[i][dayOfTheMonth - 1].text === 'N') {
            // console.log('continue')
            continue
          } else {
            driverSchedule.driverSchedule[dayOfTheMonth - 1] = 'D'
            body[i][dayOfTheMonth] = 'D'
          }
        }
      } else {
        // console.log('driver do not drive in day - skip')
        continue
      }

      assignedDs++
      if (assignedDs === daysNum) {
        assignedDs = 0
        nextDay = true
        startFromIndex = i
        startFromIndex++
        if (startFromIndex === body.length) {
          startFromIndex = 4
        }
        break
      }
    }
  }

  body = body.slice(4)
  done(null, _header, body, scheduleDocument)
}

function _createScheduleHeader (year, month, daysInMonth) {
  let header = []

  let infoBar = [
    {
      colSpan:   8,
      text:      'HARMONOGRAM DYŻURÓW:\n' + utils.monthToString(month) + ' ' + year,
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

  let title = [{
    colSpan:   (daysInMonth + 1),
    text:      'HARMONOGRAM',
    alignment: 'center',
    fontSize:  7
  }]
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
    daysNames.push(utils.numToDay(new Date(year, (month), i).getDay()))
  }
  daysNames.unshift('')

  header.push(infoBar, title, daysNums, daysNames)
  return header
}
