import styles from './Splash.module.css';

export default function Splash() {
  return (
    <div className={styles.splash}>
      <div className={styles.logo}>
        <svg className={styles.icon} viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
      <div className={styles.title}>ChatApp</div>
    </div>
  );
} 