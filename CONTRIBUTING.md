# Contributing to V-Blockchain

Thank you for your interest in contributing to V-Blockchain! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others and share knowledge

## Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/yourusername/v-blockchain.git
cd v-blockchain
```

### 2. Create Feature Branch
```bash
git checkout -b feature/YourFeatureName
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Make Changes
- Follow existing code style
- Write clean, readable code
- Add JSDoc comments for functions
- Test your changes

### 5. Test
```bash
npm test
```

All tests must pass before submitting a PR.

### 6. Commit & Push
```bash
git commit -m "Add: Brief description of change"
git push origin feature/YourFeatureName
```

### 7. Create Pull Request
- Provide clear PR title and description
- Reference related issues
- Explain what and why you changed

## Development Guidelines

### Code Style
- Use ES6+ syntax (arrow functions, const/let, etc.)
- Follow camelCase for variables and functions
- Use UPPER_CASE for constants
- Maximum line length: 100 characters
- Use 2-space indentation

### Comments & Documentation
```javascript
/**
 * Brief description of the function
 * @param {type} paramName - Description
 * @returns {type} Description of return value
 */
function myFunction(paramName) {
  // Implementation
}
```

### File Organization
```
- Core logic: Single responsibility principle
- Related functions: Group together
- Exports: At end of file
- Imports: At top of file
```

## Types of Contributions

### 1. Bug Reports
- Use GitHub Issues
- Provide reproduction steps
- Include error logs/screenshots
- Specify Node.js version

### 2. Feature Requests
- Describe the use case
- Explain expected behavior
- Consider backward compatibility
- Open issue before coding

### 3. Documentation
- Fix typos or clarifications
- Add examples
- Update diagrams
- Improve clarity

### 4. Code Improvements
- Refactoring for clarity
- Performance optimization
- Security enhancements
- Test improvements

## Testing

### Running Tests
```bash
npm test
```

### Writing Tests
- Use Jest framework
- Test critical functionality
- Mock external dependencies
- Aim for >80% coverage

### Test File Naming
- Test files: `*.test.js`
- Group related tests: `describe()` blocks
- Clear test names: `test('should...')`

## Commit Message Format

```
type(scope): brief description

Longer explanation if needed.

Fixes #123
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style
- `refactor:` Code refactoring
- `test:` Test additions
- `chore:` Build/config changes

**Examples:**
```
feat(wallet): add QR code generation
fix(p2p): handle connection timeouts
docs(readme): add installation steps
```

## Pull Request Process

1. **Update** local main branch
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Rebase** your feature branch
   ```bash
   git rebase main
   ```

3. **Push** to your fork
   ```bash
   git push origin feature/YourFeatureName --force
   ```

4. **Create PR** on GitHub
   - Add descriptive title
   - Reference related issues
   - Explain changes

5. **Address feedback**
   - Make requested changes
   - Commit and push again
   - Update PR description if needed

6. **Merge** after approval
   - Squash commits if needed
   - Delete branch after merge

## Reporting Bugs

### Good Bug Report
- Clear title: "Login fails with special characters"
- Reproduction steps (1, 2, 3...)
- Expected behavior
- Actual behavior
- Environment (OS, Node version)
- Error logs/stack traces
- Screenshots if applicable

### Bad Bug Report
- Vague title: "Something's broken"
- No steps to reproduce
- No error messages
- Missing environment info

## Security Issues

⚠️ **Do NOT** open public issues for security vulnerabilities

1. Email: security@v-blockchain.dev
2. Provide details privately
3. We'll fix and credit you

## Architecture Overview

### Core Components
- **blockchain.js**: Transaction, Block, Blockchain classes
- **wallet.js**: Key generation, address creation
- **p2p.js**: P2P networking, peer management
- **miner.js**: Mining, voting logic
- **server.js**: Bootstrap server, registry
- **electron-main.js**: GUI backend
- **gui/**: Frontend (HTML, CSS, JS)

### Key Concepts
- **Proof of Vote**: 66.7% threshold consensus
- **Block Mining**: Transaction bundling + hashing
- **P2P Broadcasting**: Message propagation
- **Wallet Persistence**: Local JSON storage

## Performance Considerations

- Avoid blocking operations
- Use async/await properly
- Minimize CPU-intensive loops
- Cache frequently accessed data
- Monitor memory usage

## Security Checklist

- [ ] No hardcoded secrets
- [ ] Input validation on user data
- [ ] Proper error handling
- [ ] Secure crypto functions
- [ ] No sensitive data in logs
- [ ] Validate signatures
- [ ] Check permissions

## Questions or Need Help?

- 📖 Read existing documentation
- 💬 Check GitHub Discussions
- 🐛 Search existing issues
- 📧 Contact maintainers
- 🔗 Ask in Discord community

---

## Review Criteria

Your PR will be reviewed based on:

✅ Code quality & style  
✅ Test coverage  
✅ Documentation  
✅ No breaking changes  
✅ Performance impact  
✅ Security implications  
✅ Alignment with project goals

## Recognition

Contributors are recognized in:
- README acknowledgments
- GitHub contributors page
- Release notes

---

**Thank you for contributing to V-Blockchain! 🚀**
