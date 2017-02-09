import { Router,
         Route,
         hashHistory,
         IndexRoute }  from 'react-router'
import { render }      from 'react-dom'
import React           from 'react'
import config          from 'config'
import AppPage         from './pages/app.page'
import DriversPage     from './pages/drivers.page'
import SchedulePage    from './pages/schedule.page'

const routes = (
  <Route path={config.routes.app} component={AppPage}>
    <IndexRoute component={DriversPage} />
    <Route path={config.routes.schedule} component={SchedulePage} />
  </Route>
)

render(
  <Router history={hashHistory} routes={routes} />,
  document.getElementById('app')
)