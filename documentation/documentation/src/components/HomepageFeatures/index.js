import React from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Create chat app',
    Svg: require('@site/static/img/chat-app.svg').default,
    description: (
      <>
        Why not create a web chat application to maybe hang out with your friends?
      </>
    ),
  },
  {
    title: 'Code Snippets',
    Svg: require('@site/static/img/code-snippets.svg').default,
    description: (
      <>
        Complete codebase and explained snippets to understand the crux of the
        chat application and easy integration.
      </>
    ),
  },
  {
    title: 'Free to follow',
    Svg: require('@site/static/img/free-follow.svg').default,
    description: (
      <>
        Thinking about database cost and storage issues? Forget it and just
        get along with the tutorial.
      </>
    ),
  },
];

function Feature({ title, Svg, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
