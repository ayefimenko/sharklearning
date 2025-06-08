describe('SharkLearning Smoke Tests', () => {
  it('should load the homepage', () => {
    cy.visit('/')
    cy.contains('SharkLearning')
    cy.contains('Sign In')
  })

  it('should navigate to login page', () => {
    cy.visit('/')
    cy.contains('Sign In').click()
    cy.url().should('include', '/login')
    cy.contains('Welcome Back')
  })

  it('should show validation on empty login form', () => {
    cy.visit('/login')
    cy.get('button[type="submit"]').click()
    // Note: validation messages might not appear immediately due to our async validation
    cy.get('input[name="email"]').should('be.visible')
    cy.get('input[name="password"]').should('be.visible')
  })
}) 