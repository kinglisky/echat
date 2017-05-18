import Vue from 'vue'
import Router from 'vue-router'
import Login from '@/pages/login.vue'
import Room from '@/pages/room.vue'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Login',
      component: Login
    },
    {
      path: '/room',
      name: 'Room',
      component: Room
    }
  ]
})
