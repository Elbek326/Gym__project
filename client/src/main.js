import './styles/base.css';
import './styles/themes.css';
import './i18n/uz.js';   /* fills the Uzbek dictionary of the I18N engine (side effect) */
import { boot } from './app.js';

boot(false);
