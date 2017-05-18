import wilddog from 'wilddog'
const config = {
  authDomain: 'vechat.wilddogio.com',
  syncURL: 'https://vechat.wilddogio.com'
}

wilddog.initializeApp(config)
const Ref = wilddog.sync()
export default Ref
