import AppActionTypes from '../constants/AppActionTypes'
import BaseStore      from './BaseStore'
import Storage        from '../services/StorageService'
import _              from 'lodash'

class DriversStore extends BaseStore {
  constructor () {
    super()
    this.subscribe(() => this._registerToActions.bind(this))
    this._drivers = []
    this._driverDetails = null
    this._isDriverNew = false
  }

  _addDriver (driver) {
    Storage.addDriver(driver, (err, driver) => {
      if (err) {
        console.error(err)
        // todo: error popup
        return
      }
      if (!driver) {
        console.error('driver didn\'t add')
        // todo: error popup
        return
      }

      this._drivers.push(driver)
      this.emitChange()
    })
  }

  _updateDriver (updatedDriver) {
    Storage.updateDriver(updatedDriver, (err, updatedDriver) => {
      if (err) {
        console.error(err)
        // todo: error popup
        return
      }
      if (!updatedDriver) {
        console.error('driver didn\'t update')
        // todo: error popup
        return
      }

      const driver = _.find(this._drivers, {_id: updatedDriver._id})
      if (driver) {
        for (let property in updatedDriver) {
          if (driver.hasOwnProperty(property) &&
              updatedDriver.hasOwnProperty(property)) {
            driver[property] = updatedDriver[property]
          }
        }
        this.emitChange()
      }
    })
  }
  
  _deleteDriver (_id) {
    Storage.deleteDriver(_id, (err) => {
      if (err) {
        console.error('driver didn\'t delete')
        // todo: error popup
        return
      }
      _.remove(this._drivers, {_id: _id})
      this.emitChange()
    })
  }

  _loadDriverDetails (driver) {
    if (driver) {
      this._isDriverNew = false
      this._driverDetails = _.cloneDeep(driver)
    } else {
      this._isDriverNew = true
      this._driverDetails = {
        id:                this.getUniqueId(),
        name:              '',
        phone:             '',
        notes:             '',
        status:            'pracuje',
        generalActivity:   true,
        dailyActivity:     true,
        nocturnalActivity: true,
        scheduleHistory:   []
      }
    }
    this._driverDetails._originId = this._driverDetails.id
    this.emitChange()
  }

  _updateDriverDetails (driver) {
    for (let property in driver) {
      if (driver.hasOwnProperty(property) &&
          this._driverDetails.hasOwnProperty(property)) {
        this._driverDetails[property] = driver[property]
      }
    }
    this.emitChange()
  }

  _rejectDriverDetails () {
    this._isDriverNew = false
    this._driverDetails = null
    this.emitChange()
  }

  _registerToActions (action) {
    switch (action.actionType) {
      case AppActionTypes.LOAD_DRIVERS:
        this._drivers = action.drivers
        this.emitChange()
        break
      
      case AppActionTypes.ADD_DRIVER:
        this._addDriver(action.driver)
        break
      
      case AppActionTypes.UPDATE_DRIVER:
        this._updateDriver(action.driver)
        break
      
      case AppActionTypes.DELETE_DRIVER:
        this._deleteDriver(action._id)
        break

      case AppActionTypes.UPDATE_DRIVER_DETAILS:
        this._updateDriverDetails(action.driver)
        break

      case AppActionTypes.SHOW_DRIVER_DETAILS:
        this._loadDriverDetails(action.driver)
        break

      case AppActionTypes.HIDE_DRIVER_DETAILS:
        this._rejectDriverDetails()
        break
    }
  }

  getUniqueId () {
    this._drivers = _.sortBy(this._drivers, ['id'])
    if (this._drivers.length) {
      let id = this._drivers[this._drivers.length - 1].id
      return (id + 1)
    } else {
      return 1
    }
  }

  isIdUnique (id) {
    let driver = _.find(this._drivers, {id: id})
    if (driver && driver.id !== this._driverDetails._originId) {
      return false
    } else {
      return true
    }
  }

  get drivers () {
    return (this._drivers = _.sortBy(this._drivers, ['id']))
  }

  get driverDetails () {
    return this._driverDetails
  }

  get isDriverNew () {
    return this._isDriverNew
  }

  get selectableDriversIds () {
    const driverIds = []
    this._drivers.forEach((driver) => {
      driverIds.push(driver.id)
    })
    return driverIds
  }
}

export default new DriversStore()
