import config            from 'config'
import React             from 'react'
// import { IndexLink }     from 'react-router'
import { Navbar, Nav, NavItem }  from 'react-bootstrap'
import { IndexLinkContainer } from 'react-router-bootstrap'

export default class AppPage extends React.Component {
  render () {
    return (
      <div>
        <Navbar>
          <Navbar.Header>
            <Navbar.Brand>
              <a href='#'>Taxi Prawobrzeże</a>
            </Navbar.Brand>
          </Navbar.Header>
          <Nav bsStyle='pills' pullRight>
            <IndexLinkContainer to={{pathname: config.routes.app}}>
              <NavItem>
                Kierowcy
              </NavItem>
            </IndexLinkContainer>
            <IndexLinkContainer to={{pathname: config.routes.schedule}}>
              <NavItem>
                Grafiki
              </NavItem>
            </IndexLinkContainer>
          </Nav>
        </Navbar>
        {this.props.children}
      </div>
    )
  }
}

// <IndexLink activeStyle={{color: '#53acff'}} to={config.routes.app}>Drivers</IndexLink>&nbsp;
// <IndexLink activeStyle={{color: '#53acff'}} to={config.routes.schedule}>Schedule</IndexLink>&nbsp;